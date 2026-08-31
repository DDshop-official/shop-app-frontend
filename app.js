/* =========================================================
   상품 데이터
   실제 서비스에서는 이 배열을 서버 API(예: GET /products)에서
   받아오도록 바꾸세요. 지금은 데모용으로 하드코딩했습니다.
========================================================= */
const PRODUCTS = [
  { id: "p1", name: "무지 노트",     price: 8900,  originalPrice: 12900, emoji: "📓", desc: "180페이지, 종이질이 좋은 무지 노트" },
  { id: "p2", name: "세라믹 머그",   price: 15000, emoji: "☕️", desc: "매트 마감의 350ml 머그컵" },
  { id: "p3", name: "황동 클립 세트", price: 6500,  emoji: "📎", desc: "책상 위를 정돈해주는 황동 클립 12개입", isNew: true },
  { id: "p4", name: "린넨 파우치",   price: 12000, emoji: "👝", desc: "가볍게 들기 좋은 린넨 소재 파우치" },
  { id: "p5", name: "손 드립 세트",  price: 32000, originalPrice: 39000, emoji: "🫖", desc: "드리퍼 + 서버 + 필터 20매" },
  { id: "p6", name: "캔들",         price: 18000, emoji: "🕯️", desc: "은은한 나무향, 연소 시간 약 40시간", isNew: true },
];

/* =========================================================
   입금받을 계좌 정보 — 실제 계좌로 바꾸세요.
========================================================= */
const BANK_INFO = {
  bank: "토스뱅크",
  accountNumber: "1001-2863-4417",
  holder: "이시연",
};

// 백엔드(backend/server.js)가 떠 있는 주소. Render에 배포한 실제 주소예요.
const BACKEND_URL = "https://shop-app-backend-vbew.onrender.com";

const money = (n) => n.toLocaleString("ko-KR") + "원";

/* =========================================================
   상태 (새로고침하면 초기화됩니다 · 데모용 메모리 상태)
========================================================= */
const cart = new Map(); // id -> qty

function findProduct(id) {
  return PRODUCTS.find((p) => p.id === id);
}

function cartTotal() {
  let total = 0;
  for (const [id, qty] of cart) total += findProduct(id).price * qty;
  return total;
}

function cartCount() {
  let c = 0;
  for (const qty of cart.values()) c += qty;
  return c;
}

/* =========================================================
   렌더링 — 상품 그리드
========================================================= */
function renderProducts() {
  const grid = document.getElementById("products");
  grid.innerHTML = PRODUCTS.map((p, i) => {
    const thumbClass = `thumb-${(i % 4) + 1}`;
    const discountPct = p.originalPrice ? Math.round((1 - p.price / p.originalPrice) * 100) : null;
    const badge = discountPct ? `${discountPct}% OFF` : (p.isNew ? "NEW" : null);
    return `
    <article class="product-card">
      <div class="product-thumb ${thumbClass}">
        ${badge ? `<span class="product-badge">${badge}</span>` : ""}
        ${p.emoji}
      </div>
      <div class="product-body">
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${p.desc}</div>
        <div class="product-foot">
          <span class="price-group">
            ${p.originalPrice ? `<span class="product-price-original">${money(p.originalPrice)}</span>` : ""}
            <span class="product-price">${money(p.price)}</span>
          </span>
          <button class="add-btn" data-id="${p.id}">담기</button>
        </div>
      </div>
    </article>
  `;
  }).join("");

  grid.querySelectorAll(".add-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      addToCart(btn.dataset.id);
      btn.textContent = "담았어요";
      btn.classList.add("added");
      setTimeout(() => {
        btn.textContent = "담기";
        btn.classList.remove("added");
      }, 900);
    });
  });
}

/* =========================================================
   렌더링 — 장바구니
========================================================= */
function renderCart() {
  document.getElementById("cartCount").textContent = cartCount();

  const wrap = document.getElementById("cartItems");
  if (cart.size === 0) {
    wrap.innerHTML = `<p class="cart-empty">아직 담은 상품이 없어요.</p>`;
  } else {
    wrap.innerHTML = [...cart.entries()].map(([id, qty]) => {
      const p = findProduct(id);
      return `
        <div class="cart-item" data-id="${id}">
          <div class="cart-item-thumb">${p.emoji}</div>
          <div class="cart-item-info">
            <div class="cart-item-name">${p.name}</div>
            <div class="cart-item-price">${money(p.price)}</div>
            <div class="qty-control">
              <button class="qty-minus" aria-label="수량 줄이기">−</button>
              <span>${qty}</span>
              <button class="qty-plus" aria-label="수량 늘리기">+</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    wrap.querySelectorAll(".cart-item").forEach((el) => {
      const id = el.dataset.id;
      el.querySelector(".qty-plus").addEventListener("click", () => changeQty(id, 1));
      el.querySelector(".qty-minus").addEventListener("click", () => changeQty(id, -1));
    });
  }

  document.getElementById("cartTotal").textContent = money(cartTotal());
  document.getElementById("goCheckout").disabled = cart.size === 0;
}

function renderReceipt() {
  const lines = [...cart.entries()].map(([id, qty]) => {
    const p = findProduct(id);
    return `<div class="receipt-row"><span>${p.name} × ${qty}</span><span>${money(p.price * qty)}</span></div>`;
  }).join("");
  document.getElementById("receiptLines").innerHTML = lines || `<div class="receipt-row"><span>담긴 상품 없음</span></div>`;
  document.getElementById("receiptTotal").textContent = money(cartTotal());
}

/* =========================================================
   장바구니 조작
========================================================= */
function addToCart(id) {
  cart.set(id, (cart.get(id) || 0) + 1);
  renderCart();
}

function changeQty(id, delta) {
  const next = (cart.get(id) || 0) + delta;
  if (next <= 0) cart.delete(id);
  else cart.set(id, next);
  renderCart();
}

/* =========================================================
   드로어 / 패널 열고 닫기
========================================================= */
const cartDrawer = document.getElementById("cartDrawer");
const cartOverlay = document.getElementById("cartOverlay");
const checkoutPanel = document.getElementById("checkoutPanel");
const checkoutOverlay = document.getElementById("checkoutOverlay");

function openCart() {
  cartDrawer.classList.add("open");
  cartOverlay.classList.add("show");
}
function closeCart() {
  cartDrawer.classList.remove("open");
  cartOverlay.classList.remove("show");
}
function openCheckout() {
  if (cart.size === 0) return;
  resetCheckoutForm();
  renderReceipt();
  closeCart();
  checkoutPanel.classList.add("open");
  checkoutOverlay.classList.add("show");
}
function closeCheckout() {
  checkoutPanel.classList.remove("open");
  checkoutOverlay.classList.remove("show");
}
function resetCheckoutForm() {
  document.getElementById("checkoutForm").hidden = false;
  document.getElementById("checkoutDone").hidden = true;
  document.getElementById("checkoutTitle").textContent = "주문 정보 입력";
  clearCheckoutError();
}

document.getElementById("cartToggle").addEventListener("click", openCart);
document.getElementById("cartClose").addEventListener("click", closeCart);
document.getElementById("cartOverlay").addEventListener("click", closeCart);
document.getElementById("goCheckout").addEventListener("click", openCheckout);
document.getElementById("checkoutClose").addEventListener("click", closeCheckout);
document.getElementById("checkoutOverlay").addEventListener("click", closeCheckout);
document.getElementById("backToShop").addEventListener("click", () => {
  cart.clear();
  renderCart();
  closeCheckout();
});

function showCheckoutError(msg) {
  const el = document.getElementById("checkoutError");
  el.textContent = msg;
  el.hidden = false;
}
function clearCheckoutError() {
  document.getElementById("checkoutError").hidden = true;
}

/* =========================================================
   주문 접수 — 무통장입금 방식
   실제 결제 연동 없이, 주문 내역만 백엔드에 저장해두고
   판매자가 입금 확인 후 admin.html에서 수동으로 승인합니다.
========================================================= */
document.getElementById("submitOrder").addEventListener("click", async () => {
  clearCheckoutError();

  const custName = document.getElementById("custName").value.trim();
  const depositorName = document.getElementById("depositorName").value.trim() || custName;
  const custPhone = document.getElementById("custPhone").value.trim();

  if (!custName) return showCheckoutError("주문자 이름을 입력해주세요.");
  if (!custPhone) return showCheckoutError("연락처를 입력해주세요.");
  if (cart.size === 0) return showCheckoutError("장바구니가 비어 있어요.");

  const items = [...cart.entries()].map(([id, qty]) => {
    const p = findProduct(id);
    return { id: p.id, name: p.name, price: p.price, qty };
  });
  const totalAmount = cartTotal();

  const submitBtn = document.getElementById("submitOrder");
  submitBtn.disabled = true;
  submitBtn.textContent = "접수하는 중...";

  try {
    const res = await fetch(`${BACKEND_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ custName, depositorName, custPhone, items, totalAmount }),
    });
    const data = await res.json();

    if (!res.ok) {
      showCheckoutError(data?.message || "주문 접수 중 문제가 발생했어요.");
      return;
    }

    showOrderDone(data.order);
  } catch (err) {
    console.error(err);
    showCheckoutError(
      `백엔드 서버(${BACKEND_URL})에 연결할 수 없어요. backend 폴더의 서버가 실행 중인지 확인해주세요.`
    );
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "주문 접수하기";
  }
});

function showOrderDone(order) {
  document.getElementById("checkoutForm").hidden = true;
  document.getElementById("checkoutDone").hidden = false;
  document.getElementById("checkoutTitle").textContent = "주문이 접수됐어요";

  document.getElementById("bankName").textContent = BANK_INFO.bank;
  document.getElementById("bankAccount").textContent = BANK_INFO.accountNumber;
  document.getElementById("bankHolder").textContent = BANK_INFO.holder;

  document.getElementById("doneOrderId").textContent = order.id;
  document.getElementById("doneCustName").textContent = order.custName;
  document.getElementById("doneDepositor").textContent = order.depositorName;
  document.getElementById("doneTotal").textContent = money(order.totalAmount);
  document.getElementById("doneDepositor2").textContent = order.depositorName;
  document.getElementById("doneTotal2").textContent = money(order.totalAmount);
}

document.getElementById("copyAccount").addEventListener("click", async () => {
  const btn = document.getElementById("copyAccount");
  try {
    await navigator.clipboard.writeText(BANK_INFO.accountNumber.replace(/-/g, ""));
    btn.textContent = "복사됐어요";
  } catch (_) {
    btn.textContent = BANK_INFO.accountNumber;
  }
  setTimeout(() => (btn.textContent = "계좌번호 복사"), 1200);
});

/* =========================================================
   초기 렌더
========================================================= */
renderProducts();
renderCart();
