/**
 * 결제대행사(PG) 없이 "무통장입금" 방식으로 운영하는 최소 백엔드입니다.
 *
 * 흐름:
 *   1) 구매자가 상품을 담고 주문자명/입금자명/연락처를 입력해 주문을 접수합니다. (POST /orders)
 *   2) 사이트는 판매자의 계좌 정보를 안내합니다. (계좌 정보는 프론트엔드 app.js에 있어요)
 *   3) 구매자가 실제로 계좌 이체를 하면, 판매자가 본인 뱅킹 앱 등에서 입금 내역을 직접 확인합니다.
 *   4) 판매자가 admin.html에서 해당 주문을 찾아 "입금 확인" 버튼을 누르면 주문 상태가 paid로 바뀝니다. (POST /orders/:id/confirm)
 *
 * 주문 데이터는 별도 DB 없이 backend/data/orders.json 파일에 저장합니다.
 * 트래픽이 적은 개인/소규모 판매에는 충분하지만, 여러 대의 서버로 확장하거나
 * 동시 접속이 많아지면 실제 데이터베이스(PostgreSQL, SQLite 등)로 바꾸는 걸 추천해요.
 */
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4242;
const ADMIN_KEY = process.env.ADMIN_KEY;

if (!ADMIN_KEY) {
  console.warn(
    "[경고] ADMIN_KEY가 설정되지 않았어요. backend/.env 파일을 만들고 .env.example을 참고하세요. " +
    "설정하지 않으면 누구나 주문 목록을 볼 수 있어요."
  );
}

/* =========================================================
   아주 단순한 파일 기반 저장소
========================================================= */
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "orders.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]", "utf-8");
}

function readOrders() {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch (err) {
    console.error("orders.json을 읽는 중 오류:", err);
    return [];
  }
}

function writeOrders(orders) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2), "utf-8");
}

function makeOrderId() {
  const date = new Date();
  const ymd = date.toISOString().slice(2, 10).replace(/-/g, ""); // e.g. 260829
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase(); // 4 hex chars
  return `${ymd}-${rand}`;
}

/* =========================================================
   관리자 인증 (아주 단순한 공유 키 방식)
   프로덕션에서는 로그인/세션 등 더 견고한 인증으로 바꾸세요.
========================================================= */
function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) return next(); // 키를 설정하지 않았으면 통과 (로컬 테스트 편의용)
  const key = req.header("x-admin-key");
  if (key !== ADMIN_KEY) {
    return res.status(401).json({ message: "관리자 키가 올바르지 않아요." });
  }
  next();
}

/* =========================================================
   라우트
========================================================= */
app.get("/", (_req, res) => {
  res.json({ ok: true, message: "shop-app backend (무통장입금 모드) is running" });
});

// 주문 접수 — 구매자가 사용
app.post("/orders", (req, res) => {
  const { depositorName, custAccountNumber, custBank, items, totalAmount } = req.body || {};

  if (!depositorName || !custAccountNumber || !custBank) {
    return res.status(400).json({ message: "입금자명/계좌번호/은행은 필수예요." });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "주문할 상품이 없어요." });
  }

  // 서버에서 금액을 다시 계산해 클라이언트가 보낸 금액과 대조합니다.
  // (지금은 가격 정보를 프론트엔드가 같이 보내주는 간단한 구조라 완벽한 검증은 아니에요.
  //  실제 서비스라면 서버가 상품 가격을 직접 알고 있는 상태에서 재계산해야 해요.)
  const recalculated = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  if (typeof totalAmount === "number" && Math.abs(recalculated - totalAmount) > 0) {
    return res.status(400).json({ message: "주문 금액이 일치하지 않아요." });
  }

  const order = {
    id: makeOrderId(),
    depositorName,
    custAccountNumber,
    custBank,
    items,
    totalAmount: recalculated,
    status: "pending", // pending | paid | cancelled
    createdAt: new Date().toISOString(),
    paidAt: null,
  };

  const orders = readOrders();
  orders.push(order);
  writeOrders(orders);

  res.status(201).json({ order });
});

// 주문 목록 조회 — 판매자(관리자)만
app.get("/orders", requireAdmin, (_req, res) => {
  const orders = readOrders();
  res.json({ orders });
});

// 입금 확인 처리 — 판매자가 실제 계좌 내역을 확인한 뒤 수동으로 호출
app.post("/orders/:id/confirm", requireAdmin, (req, res) => {
  const orders = readOrders();
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ message: "주문을 찾을 수 없어요." });

  order.status = "paid";
  order.paidAt = new Date().toISOString();
  writeOrders(orders);
  res.json({ order });
});

// 주문 취소 — 판매자가 입금이 안 왔거나 문제가 있을 때
app.post("/orders/:id/cancel", requireAdmin, (req, res) => {
  const orders = readOrders();
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ message: "주문을 찾을 수 없어요." });

  order.status = "cancelled";
  writeOrders(orders);
  res.json({ order });
});

app.listen(PORT, () => {
  console.log(`shop-app backend listening on http://localhost:${PORT}`);
});
