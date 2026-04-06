document.addEventListener('DOMContentLoaded', () => {
    // ---- DOM ELEMENTS ----
    const DOMElements = {
        productsGrid: document.getElementById('productsGrid'),
        loginBtn: document.getElementById('loginBtn'),
        loginModal: document.getElementById('loginModal'),
        closeLoginBtn: document.getElementById('closeLoginBtn'),
        loginForm: document.getElementById('loginForm'),
        authContainer: document.getElementById('authContainer'),
        profileBtn: document.getElementById('profileBtn'),
        userMenu: document.getElementById('userMenu'),
        userNameDisplay: document.getElementById('userNameDisplay'),
        logoutBtn: document.getElementById('logoutBtn'),
        cartBtn: document.getElementById('cartBtn'),
        cartOverlay: document.getElementById('cartOverlay'),
        closeCartBtn: document.getElementById('closeCartBtn'),
        cartItems: document.getElementById('cartItems'),
        cartBadgeCount: document.getElementById('cartBadgeCount'),
        cartCountHeader: document.getElementById('cartCountHeader'),
        cartTotalPrice: document.getElementById('cartTotalPrice'),
        checkoutBtn: document.getElementById('checkoutBtn'),
        orderHistoryBtn: document.getElementById('orderHistoryBtn'),
        orderModal: document.getElementById('orderModal'),
        closeOrderBtn: document.getElementById('closeOrderBtn'),
        orderListContainer: document.getElementById('orderListContainer'),
        chatToggleBtn: document.getElementById('chatToggleBtn'),
        chatWindow: document.getElementById('chatWindow'),
        closeChatBtn: document.getElementById('closeChatBtn'),
        chatMessages: document.getElementById('chatMessages'),
        chatUnauthOverlay: document.getElementById('chatUnauthOverlay'),
        chatInputMessage: document.getElementById('chatInputMessage'),
        chatSendBtn: document.getElementById('chatSendBtn')
    };

    // ---- APP STATE ----
    let State = {
        token: localStorage.getItem('token') || null,
        user: null,
        cachedProducts: [],
        socket: null
    };

    // ---- INIT FLOW ----
    async function init() {
        showToast("Đang kết nối hệ thống...", "info");
        await fetchProducts(); // Tải Sản phẩm ẩn danh
        if (State.token) {
            await verifyToken();
        }
        setupEventListeners();
    }

    // ---- API UTILS ----
    async function apiCall(endpoint, method = 'GET', body = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (State.token) headers['Authorization'] = 'Bearer ' + State.token;
        const options = { method, headers };
        if (body) options.body = JSON.stringify(body);
        
        try {
            const response = await fetch(endpoint, options);
            const isJson = response.headers.get('content-type')?.includes('application/json');
            const data = isJson ? await response.json() : await response.text();
            if (!response.ok) throw { status: response.status, data };
            return data;
        } catch (error) {
            throw error;
        }
    }

    function showToast(text, type = 'success') {
        let bg = type === 'success' ? '#10B981' : (type === 'error' ? '#EF4444' : '#3B82F6');
        Toastify({ text, duration: 3000, position: 'right', style: { background: bg, borderRadius: '8px' } }).showToast();
    }

    // ---- AUTHENTICATION ----
    async function verifyToken() {
        try {
            State.user = await apiCall('/auth/me', 'GET');
            uiSetAuthenticated(true);
            await loadCart();
            initSocket(); // Connect Live Chat
        } catch (err) {
            console.error('Verify token failed', err);
            uiSetAuthenticated(false);
            localStorage.removeItem('token');
            State.token = null;
        }
    }

    DOMElements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = document.getElementById('loginUsername').value;
        const p = document.getElementById('loginPassword').value;
        try {
            const token = await apiCall('/auth/login', 'POST', { username: u, password: p });
            State.token = token;
            localStorage.setItem('token', token);
            DOMElements.loginModal.classList.remove('active');
            showToast("Đăng nhập thành công!");
            await verifyToken();
        } catch (err) {
            showToast(err.data?.message || err.data || "Đăng nhập thất bại", "error");
        }
    });

    DOMElements.logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await apiCall('/auth/logout', 'POST');
        } catch {}
        localStorage.removeItem('token');
        State.token = null;
        State.user = null;
        if(State.socket) State.socket.disconnect();
        uiSetAuthenticated(false);
        uiRenderEmptyCart();
        showToast("Đã xuất tài khoản", "info");
    });

    function uiSetAuthenticated(isAuth) {
        if (isAuth && State.user) {
            DOMElements.loginBtn.style.display = 'none';
            DOMElements.userMenu.style.display = 'block';
            DOMElements.userNameDisplay.textContent = State.user.username;
            DOMElements.chatUnauthOverlay.classList.add('hidden');
            DOMElements.chatInputMessage.disabled = false;
            DOMElements.chatSendBtn.disabled = false;
        } else {
            DOMElements.loginBtn.style.display = 'flex';
            DOMElements.userMenu.style.display = 'none';
            DOMElements.chatUnauthOverlay.classList.remove('hidden');
            DOMElements.chatInputMessage.disabled = true;
            DOMElements.chatSendBtn.disabled = true;
        }
    }

    // ---- PRODUCTS ----
    async function fetchProducts() {
        try {
            const data = await apiCall('/products');
            State.cachedProducts = data.filter(p => !p.isDeleted);
            uiRenderProducts();
        } catch (err) {
            DOMElements.productsGrid.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color:red;">Lỗi tải sản phẩm.</p>`;
        }
    }

    function uiRenderProducts() {
        if (!State.cachedProducts.length) {
            DOMElements.productsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align:center">Chưa có sản phẩm nào.</p>';
            return;
        }
        DOMElements.productsGrid.innerHTML = '';
        State.cachedProducts.forEach(product => {
            let img = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80';
            if (product.images && product.images[0]) img = product.images[0].startsWith('http') ? product.images[0] : '/' + product.images[0].replace(/\\/g, '/');
            product.displayImg = img;
            
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <div class="product-img-wrapper"><img src="${img}" alt="Item"></div>
                <div class="product-cat">${product.category || 'Shop'}</div>
                <div class="product-title">${product.title}</div>
                <div class="product-price">$${product.price.toLocaleString()}</div>
                <button class="add-btn" data-id="${product._id}" title="Mua"><i class="fa-solid fa-plus"></i></button>
            `;
            DOMElements.productsGrid.appendChild(card);
        });

        document.querySelectorAll('.add-btn').forEach(b => {
            b.addEventListener('click', async (e) => {
                if(!State.token) {
                    showToast("Vui lòng đăng nhập trước", "error");
                    DOMElements.loginModal.classList.add('active');
                    return;
                }
                const id = e.currentTarget.getAttribute('data-id');
                try {
                    await apiCall('/carts/add-cart', 'POST', { product: id, quantity: 1 });
                    showToast("Đã thêm vào giỏ hàng!");
                    loadCart();
                } catch (err) {
                    showToast(err.data?.message || "Lỗi khi thêm kho", "error");
                }
            });
        });
    }

    // ---- CARTS & CHECKOUT ----
    async function loadCart() {
        try {
            const items = await apiCall('/carts/get-cart');
            uiRenderCart(items);
        } catch (err) {
            uiRenderEmptyCart();
        }
    }

    window.cartChangeQty = async (id, type) => {
        try {
            const url = type === 'add' ? '/carts/add-one' : '/carts/reduce';
            await apiCall(url, 'POST', { product:id });
            loadCart();
        } catch(err) { showToast(err.data?.message || "Lỗi", "error"); }
    };

    window.cartRemove = async (id) => {
        try {
            await apiCall('/carts/remove', 'POST', { product:id });
            loadCart();
        } catch(err) { showToast(err.data?.message || "Lỗi", "error"); }
    };

    function uiRenderEmptyCart() {
        DOMElements.cartItems.innerHTML = `<div class="empty-cart"><i class="fa-solid fa-bag-shopping"></i><p>Trống.</p></div>`;
        DOMElements.cartBadgeCount.textContent = "0";
        DOMElements.cartCountHeader.textContent = "0";
        DOMElements.cartTotalPrice.textContent = "$0";
        DOMElements.checkoutBtn.disabled = true;
    }

    function uiRenderCart(items) {
        if(!items || items.length === 0) return uiRenderEmptyCart();
        DOMElements.cartItems.innerHTML = '';
        let totalQty = 0; let totalAmt = 0;
        
        items.forEach(item => {
            totalQty += item.quantity;
            const pInfo = State.cachedProducts.find(p => p._id === item.product);
            if(!pInfo) return; // if product got deleted, skip logic
            totalAmt += (pInfo.price * item.quantity);
            
            const el = document.createElement('div');
            el.className = 'cart-item-row';
            el.innerHTML = `
                <div style="display:flex; gap:10px; margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:10px;">
                    <img src="${pInfo.displayImg}" style="width:60px; height:60px; border-radius:8px; object-fit:cover;">
                    <div style="flex:1;">
                        <h5 style="margin:0; font-size:0.95rem;">${pInfo.title}</h5>
                        <p style="color:var(--primary); margin:0;">$${pInfo.price.toLocaleString()}</p>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
                        <button class="cart-del-btn" onclick="cartRemove('${item.product}')"><i class="fa-solid fa-trash"></i></button>
                        <div class="cart-qty-controls">
                            <button class="cart-qty-btn" onclick="cartChangeQty('${item.product}','reduce')">-</button>
                            <span style="font-weight:600; font-size:0.9rem;">${item.quantity}</span>
                            <button class="cart-qty-btn" onclick="cartChangeQty('${item.product}','add')">+</button>
                        </div>
                    </div>
                </div>
            `;
            DOMElements.cartItems.appendChild(el);
        });

        DOMElements.cartBadgeCount.textContent = totalQty;
        DOMElements.cartCountHeader.textContent = totalQty;
        DOMElements.cartTotalPrice.textContent = "$" + totalAmt.toLocaleString();
        DOMElements.checkoutBtn.disabled = false;
    }

    DOMElements.checkoutBtn.addEventListener('click', async () => {
        try {
            DOMElements.checkoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Xử lý...';
            DOMElements.checkoutBtn.disabled = true;
            await apiCall('/orders/checkout', 'POST', { shippingAddress: "Dia chi test UI" });
            showToast("Thanh toán thành công! Trừ kho hoàn tất.", "success");
            DOMElements.cartOverlay.classList.remove('active');
            loadCart(); // Should be empty now
            fetchProducts(); // Refresh stock if we show it
        } catch (err) {
            showToast(err.data?.message || "Lỗi khi Checkout", "error");
        } finally {
            DOMElements.checkoutBtn.innerHTML = 'Tiến hành Thanh toán';
            DOMElements.checkoutBtn.disabled = false;
        }
    });

    DOMElements.orderHistoryBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        DOMElements.orderListContainer.innerHTML = '<p>Đang tải...</p>';
        DOMElements.orderModal.classList.add('active');
        DOMElements.userMenu.classList.remove('active');
        try {
            const orders = await apiCall('/orders');
            if(orders.length===0) DOMElements.orderListContainer.innerHTML = '<p>Chưa có giao dịch.</p>';
            else {
                DOMElements.orderListContainer.innerHTML = '';
                orders.forEach(o => {
                    const statusClass = (o.status==='PENDING') ? 'bg-orange-500' : 'bg-green-500';
                    DOMElements.orderListContainer.innerHTML += `
                        <div class="order-item">
                            <h4>Mã: ${o._id}</h4>
                            <p>Ngày: ${new Date(o.createdAt).toLocaleString()}</p>
                            <p>Địa chỉ: ${o.shippingAddress}</p>
                            <div style="display:flex; justify-content:space-between; margin-top:10px;">
                                <span class="badge" style="background:var(--primary);">${o.status}</span>
                                <strong>$${o.totalPrice.toLocaleString()}</strong>
                            </div>
                        </div>
                    `;
                });
            }
        } catch(err) {
            DOMElements.orderListContainer.innerHTML = '<p>Lỗi tải lịch sử.</p>';
        }
    });

    // ---- SOCKET.IO CHAT ----
    let activeSupportId = null;

    async function loadAgents() {
        try {
            const agents = await apiCall('/users/staff');
            const list = document.getElementById('agentList');
            if(agents.length === 0) {
                list.innerHTML = '<p class="text-center">Chưa có QTV hỗ trợ.</p>';
                return;
            }
            list.innerHTML = '';
            agents.forEach(a => {
                const btn = document.createElement('button');
                btn.style = "padding:12px; border:1px solid var(--border); border-radius:12px; background:white; cursor:pointer; text-align:left; display:flex; align-items:center; gap:10px;";
                btn.innerHTML = `<i class="fa-solid fa-headset" style="color:var(--primary)"></i> <b>${a.username}</b> <span style="font-size:0.8rem; color:var(--text-muted)">(${a.role?.name || 'Support'})</span>`;
                btn.onclick = () => openChatRoom(a);
                list.appendChild(btn);
            });
        } catch(err) {
            document.getElementById('agentList').innerHTML = '<p style="color:red">Lỗi tải danh sách Support</p>';
        }
    }

    async function openChatRoom(agent) {
        activeSupportId = agent._id;
        document.getElementById('chatAgentSelector').style.display = 'none';
        document.getElementById('chatRoom').style.display = 'flex';
        document.getElementById('chatHeaderTitle').innerHTML = `<i class="fa-solid fa-headset"></i> Đang Chat với: ${agent.username}`;
        document.getElementById('backChatBtn').style.display = 'inline-block';
        
        DOMElements.chatInputMessage.disabled = false;
        DOMElements.chatSendBtn.disabled = false;
        DOMElements.chatInputMessage.placeholder = "Nhập tin nhắn hỗ trợ...";

        try {
            const msgs = await apiCall('/messages/' + agent._id);
            const chatRoom = document.getElementById('chatRoom');
            chatRoom.innerHTML = '';
            msgs.reverse().forEach(m => {
                // handle m.from formatting
                let fromId = typeof m.from === 'object' ? m.from._id : m.from;
                addChatMessage(m.message?.text || 'File...', fromId === State.user._id ? 'sent' : 'received');
            });
            chatRoom.scrollTop = chatRoom.scrollHeight;
        } catch(err) {
            addChatMessage("Lỗi khi tải lịch sử.", "system");
        }
    }

    document.getElementById('backChatBtn').addEventListener('click', () => {
        document.getElementById('chatRoom').style.display = 'none';
        document.getElementById('chatAgentSelector').style.display = 'block';
        document.getElementById('backChatBtn').style.display = 'none';
        document.getElementById('chatHeaderTitle').innerHTML = `<i class="fa-solid fa-headset"></i> MyShop Support`;
        activeSupportId = null;
    });

    function initSocket() {
        if(typeof io === 'undefined') return;
        if(State.socket) State.socket.disconnect();
        
        State.socket = io({ auth: { token: State.token }});
        State.socket.on('new_message', (msg) => {
            const fromId = typeof msg.from === 'object' ? msg.from._id : msg.from;
            if(activeSupportId === fromId) {
                addChatMessage(msg.message?.text, 'received');
            } else {
                document.getElementById('chatUnreadBadge').style.display = 'flex';
            }
        });
        loadAgents();
    }

    function addChatMessage(text, type='sent') {
        const div = document.createElement('div');
        div.className = `msg ${type}`;
        div.textContent = text;
        const room = document.getElementById('chatRoom');
        room.appendChild(div);
        room.scrollTop = room.scrollHeight;
    }

    DOMElements.chatSendBtn.addEventListener('click', async () => {
        const txt = DOMElements.chatInputMessage.value.trim();
        if(!txt || !activeSupportId) return;
        DOMElements.chatInputMessage.value = '';
        addChatMessage(txt, 'sent');
        try {
            await apiCall('/messages', 'POST', { to: activeSupportId, message: txt });
        } catch(err) {
            showToast("Gửi tin nhắn bị lỗi", "error");
        }
    });

    DOMElements.chatInputMessage.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') DOMElements.chatSendBtn.click();
    });

    // ---- EVENT LISTENERS UTILS ----
    function setupEventListeners() {
        DOMElements.loginBtn.addEventListener('click', () => DOMElements.loginModal.classList.add('active'));
        DOMElements.closeLoginBtn.addEventListener('click', () => DOMElements.loginModal.classList.remove('active'));
        DOMElements.cartBtn.addEventListener('click', () => DOMElements.cartOverlay.classList.add('active'));
        DOMElements.closeCartBtn.addEventListener('click', () => DOMElements.cartOverlay.classList.remove('active'));
        DOMElements.closeOrderBtn.addEventListener('click', () => DOMElements.orderModal.classList.remove('active'));
        DOMElements.profileBtn.addEventListener('click', () => DOMElements.userMenu.classList.toggle('active'));
        
        // Chat Handlers
        const widgetContainer = document.querySelector('.chat-widget-container');
        DOMElements.chatToggleBtn.addEventListener('click', () => widgetContainer.classList.toggle('open'));
        DOMElements.closeChatBtn.addEventListener('click', () => widgetContainer.classList.remove('open'));

        window.addEventListener('click', (e) => {
            if(e.target === DOMElements.loginModal) DOMElements.loginModal.classList.remove('active');
            if(e.target === DOMElements.cartOverlay) DOMElements.cartOverlay.classList.remove('active');
            if(e.target === DOMElements.orderModal) DOMElements.orderModal.classList.remove('active');
            if(!DOMElements.authContainer.contains(e.target)) DOMElements.userMenu.classList.remove('active');
        });
    }

    init();
});
