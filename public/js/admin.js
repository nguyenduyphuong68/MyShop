document.addEventListener('DOMContentLoaded', () => {
    // ---- DOM Elements ----
    const DOMElements = {
        body: document.getElementById('adminBody'),
        adminName: document.getElementById('adminName'),
        logoutBtn: document.getElementById('logoutBtn'),
        navLinks: document.querySelectorAll('.nav-links li'),
        tabPanes: document.querySelectorAll('.tab-pane'),
        
        productsTableBody: document.getElementById('productsTableBody'),
        usersTableBody: document.getElementById('usersTableBody'),
        ordersTableBody: document.getElementById('ordersTableBody'),

        productModal: document.getElementById('productModal'),
        openAddProductModal: document.getElementById('openAddProductModal'),
        closeProductModal: document.getElementById('closeProductModal'),
        productForm: document.getElementById('productForm'),
        
        prodId: document.getElementById('prodId'),
        prodTitle: document.getElementById('prodTitle'),
        prodPrice: document.getElementById('prodPrice'),
        prodStock: document.getElementById('prodStock'),
        prodCategory: document.getElementById('prodCategory'),
        stockGroup: document.getElementById('stockGroup'),
        productModalTitle: document.getElementById('productModalTitle'),

        adminChatList: document.getElementById('adminChatList'),
        adminActiveChatName: document.getElementById('adminActiveChatName'),
        adminChatHistory: document.getElementById('adminChatHistory'),
        adminChatInput: document.getElementById('adminChatInput'),
        adminSendChatBtn: document.getElementById('adminSendChatBtn')
    };

    let State = {
        token: localStorage.getItem('token') || null,
        adminUser: null,
        socket: null,
        activeChatUserId: null
    };

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
        let bg = type === 'success' ? '#10B981' : '#EF4444';
        Toastify({ text, duration: 3000, position: 'right', style: { background: bg, borderRadius: '8px' } }).showToast();
    }

    // ---- AUTH GATEKEEPER ----
    async function verifyAdmin() {
        if (!State.token) {
            window.location.href = '/index.html';
            return;
        }
        try {
            const user = await apiCall('/auth/me', 'GET');
            if (!user.role || user.role.name !== 'ADMIN') {
                showToast("Bạn không có quyền truy cập Admin!", "error");
                setTimeout(() => window.location.href = '/index.html', 1500);
                return;
            }
            State.adminUser = user;
            DOMElements.adminName.textContent = user.username;
            DOMElements.body.style.display = 'block'; // Reveal content
            loadProducts();
            loadUsers();
            loadOrders();
            loadChatList();
            initSocket();
        } catch (err) {
            localStorage.removeItem('token');
            window.location.href = '/index.html';
        }
    }

    // ---- TAB NAVIGATION ----
    DOMElements.navLinks.forEach(link => {
        link.addEventListener('click', () => {
            // Remove active from all
            DOMElements.navLinks.forEach(l => l.classList.remove('active'));
            DOMElements.tabPanes.forEach(t => t.classList.remove('active'));
            
            // Add active to current
            link.classList.add('active');
            const tabId = link.getAttribute('data-tab');
            document.getElementById('tab-' + tabId).classList.add('active');
            
            if(tabId === 'chat') {
                const badge = link.querySelector('.red-badge');
                if(badge) badge.remove();
            }
        });
    });

    DOMElements.logoutBtn.addEventListener('click', async () => {
        try { await apiCall('/auth/logout', 'POST'); } catch {}
        localStorage.removeItem('token');
        window.location.href = '/index.html';
    });

    // ---- DATA LOADING ----

    // 1. PRODUCTS
    async function loadProducts() {
        try {
            const products = await apiCall('/products');
            if (products.length === 0) {
                DOMElements.productsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Chưa có sản phẩm.</td></tr>';
                return;
            }
            
            // We fetch the latest products but their quantity might be 0, or isDeleted true
            DOMElements.productsTableBody.innerHTML = '';
            products.reverse().forEach(p => {
                const statusHtml = p.isDeleted 
                    ? '<span class="badge badge-deleted">Đã Xóa</span>' 
                    : '<span class="badge badge-active">Hoạt Động</span>';
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-family:monospace; font-size:0.8rem; color:#6B7280;">${p.sku || p._id}</td>
                    <td style="font-weight:500;">${p.title}</td>
                    <td style="color:var(--primary); font-weight:600;">$${p.price.toLocaleString()}</td>
                    <td>${p.quantity}</td>
                    <td>${statusHtml}</td>
                    <td>
                        ${!p.isDeleted ? `
                            <button class="btn btn-sm btn-edit" onclick="editProduct('${p._id}', '${p.title.replace(/'/g, "\\'")}', ${p.price}, '${p.category || ''}')"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p._id}')"><i class="fa-solid fa-trash"></i></button>
                        ` : ''}
                    </td>
                `;
                DOMElements.productsTableBody.appendChild(tr);
            });
        } catch (err) {
            DOMElements.productsTableBody.innerHTML = '<tr><td colspan="6" class="text-center" style="color:red;">Lỗi tải dữ liệu.</td></tr>';
        }
    }

    // 2. USERS
    async function loadUsers() {
        try {
            const users = await apiCall('/users', 'GET');
            if (!users || users.length === 0) {
                DOMElements.usersTableBody.innerHTML = '<tr><td colspan="4" class="text-center">Chưa có user.</td></tr>';
                return;
            }
            DOMElements.usersTableBody.innerHTML = '';
            users.forEach(u => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-family:monospace; font-size:0.8rem; color:#6B7280;">${u._id}</td>
                    <td style="font-weight:500;">${u.username} <span class="badge" style="background:#E5E7EB;color:#374151;">${u.role?.name || ''}</span></td>
                    <td>${u.email}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="deleteUser('${u._id}')"><i class="fa-solid fa-lock"></i> Khóa</button>
                    </td>
                `;
                DOMElements.usersTableBody.appendChild(tr);
            });
        } catch (err) {
            DOMElements.usersTableBody.innerHTML = '<tr><td colspan="4" class="text-center" style="color:red;">Lỗi tải dữ liệu / Không đủ quyền.</td></tr>';
        }
    }

    // 3. ORDERS (Admin View All)
    async function loadOrders() {
        try {
            const orders = await apiCall('/orders/all', 'GET');
            if (!orders || orders.length === 0) {
                DOMElements.ordersTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Chưa có giao dịch.</td></tr>';
                return;
            }
            DOMElements.ordersTableBody.innerHTML = '';
            orders.forEach(o => {
                const badgeStyle = o.status === 'PENDING' ? 'background:#F59E0B;' : 'background:#10B981;';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-family:monospace; font-size:0.8rem;">${o._id}</td>
                    <td style="font-weight:500;">${o.user ? o.user.username : 'Ẩn danh'}</td>
                    <td>${new Date(o.createdAt).toLocaleString()}</td>
                    <td style="color:var(--primary); font-weight:600;">$${o.totalPrice.toLocaleString()}</td>
                    <td><span class="badge" style="${badgeStyle} color:white;">${o.status}</span></td>
                `;
                DOMElements.ordersTableBody.appendChild(tr);
            });
        } catch (err) {
            DOMElements.ordersTableBody.innerHTML = '<tr><td colspan="5" class="text-center" style="color:red;">Lỗi tải lịch sử đơn hàng.</td></tr>';
        }
    }

    // ---- PRODUCT ACTIONS ----
    DOMElements.openAddProductModal.addEventListener('click', () => {
        DOMElements.productForm.reset();
        DOMElements.prodId.value = '';
        DOMElements.productModalTitle.textContent = "Thêm Sản Phẩm Mới";
        DOMElements.stockGroup.style.display = 'block'; // Show stock only on Add
        DOMElements.productModal.classList.add('active');
    });

    DOMElements.closeProductModal.addEventListener('click', () => {
        DOMElements.productModal.classList.remove('active');
    });

    DOMElements.productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = DOMElements.prodId.value;
        const body = {
            title: DOMElements.prodTitle.value,
            price: Number(DOMElements.prodPrice.value),
            category: DOMElements.prodCategory.value
        };

        try {
            if (id) {
                // Edit
                await apiCall('/products/' + id, 'PUT', body);
                showToast("Cập nhật thành công!");
            } else {
                // Add
                body.stock = Number(DOMElements.prodStock.value);
                await apiCall('/products', 'POST', body);
                showToast("Thêm dòng sản phẩm thành công!");
            }
            DOMElements.productModal.classList.remove('active');
            loadProducts(); // refresh table
        } catch (err) {
            showToast("Lỗi: " + (err.data?.message || JSON.stringify(err.data)), "error");
        }
    });

    window.editProduct = (id, title, price, category) => {
        DOMElements.productModalTitle.textContent = "Chỉnh sửa Sản Phẩm";
        DOMElements.prodId.value = id;
        DOMElements.prodTitle.value = title;
        DOMElements.prodPrice.value = price;
        DOMElements.prodCategory.value = category;
        DOMElements.stockGroup.style.display = 'none'; // Don't allow changing stock directly here via POST logic
        DOMElements.productModal.classList.add('active');
    };

    window.deleteProduct = async (id) => {
        if (!confirm("Bạn có chắc chắn muốn xóa mềm (vô hiệu hóa) sản phẩm này?")) return;
        try {
            await apiCall('/products/' + id, 'DELETE');
            showToast("Đã khóa sản phẩm!");
            loadProducts();
        } catch (err) {
            showToast("Không thể xóa lúc này", "error");
        }
    };

    window.deleteUser = async (id) => {
        if (!confirm("Khóa tài khoản này ra khỏi hệ thống?")) return;
        try {
            await apiCall('/users/' + id, 'DELETE');
            showToast("Đã khóa User!");
            loadUsers();
        } catch (err) {
            showToast("Lỗi khóa User", "error");
        }
    };

    // Close Modal on Overlay Click
    window.addEventListener('click', (e) => {
        if(e.target === DOMElements.productModal) {
            DOMElements.productModal.classList.remove('active');
        }
    });

    // ---- ADMIN CHAT SYSTEM ----
    async function loadChatList() {
        try {
            const convos = await apiCall('/messages', 'GET');
            if (convos.length === 0) {
                DOMElements.adminChatList.innerHTML = '<p style="padding:20px; text-align:center; color:var(--text-muted);">Trống.</p>';
                return;
            }
            DOMElements.adminChatList.innerHTML = '';
            convos.forEach(message => {
                if (!message.from || !message.to) return;
                const otherUser = message.from._id === State.adminUser._id ? message.to : message.from;
                const div = document.createElement('div');
                div.style = "padding:15px; border-bottom:1px solid var(--border); cursor:pointer; transition:background 0.2s;";
                div.onmouseover = () => div.style.background = '#EFF6FF';
                div.onmouseout = () => div.style.background = 'transparent';
                
                div.innerHTML = `
                    <div style="font-weight:600; display:flex; justify-content:space-between;">
                        ${otherUser.username}
                        <span style="font-size:0.75rem; color:var(--text-muted)">${new Date(message.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div style="color:var(--text-muted); font-size:0.85rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                        ${message.from._id === State.adminUser._id ? 'Bạn: ' : ''}${message.message?.text || 'File image...'}
                    </div>
                `;
                div.addEventListener('click', () => {
                    document.querySelectorAll('#adminChatList > div').forEach(d => d.style.borderLeft = 'none');
                    div.style.borderLeft = '4px solid var(--primary)';
                    openAdminChat(otherUser);
                });
                DOMElements.adminChatList.appendChild(div);
            });
        } catch(err) {
            console.error("Load chat list failed", err);
        }
    }

    async function openAdminChat(user) {
        State.activeChatUserId = user._id;
        DOMElements.adminActiveChatName.textContent = "Khách hàng: " + user.username;
        DOMElements.adminChatInput.disabled = false;
        DOMElements.adminSendChatBtn.disabled = false;
        DOMElements.adminChatHistory.innerHTML = '<p class="text-center">Đang tải tin nhắn...</p>';
        try {
            const msgs = await apiCall('/messages/' + user._id, 'GET');
            DOMElements.adminChatHistory.innerHTML = '';
            msgs.reverse().forEach(m => appendAdminMessage(m));
        } catch(err) {
            DOMElements.adminChatHistory.innerHTML = '<p class="text-center" style="color:red">Lỗi tải tin.</p>';
        }
    }

    function appendAdminMessage(m) {
        const fromId = typeof m.from === 'object' ? m.from._id : m.from;
        const isMe = fromId === State.adminUser._id;
        const div = document.createElement('div');
        div.style = `padding:10px 14px; border-radius:16px; max-width:80%; font-size:0.95rem; line-height:1.4; align-self: ${isMe ? 'flex-end' : 'flex-start'}; background: ${isMe ? 'var(--primary)' : 'var(--border)'}; color: ${isMe ? 'white' : 'var(--text-main)'}; border-bottom-${isMe?'right':'left'}-radius: 4px;`;
        div.textContent = m.message?.text || '';
        DOMElements.adminChatHistory.appendChild(div);
        DOMElements.adminChatHistory.scrollTop = DOMElements.adminChatHistory.scrollHeight;
    }

    DOMElements.adminSendChatBtn.addEventListener('click', async () => {
        const txt = DOMElements.adminChatInput.value.trim();
        if(!txt || !State.activeChatUserId) return;
        try {
            const newMsg = await apiCall('/messages', 'POST', { to: State.activeChatUserId, message: txt });
            appendAdminMessage(newMsg);
            DOMElements.adminChatInput.value = '';
            loadChatList(); // refresh sidebar
        } catch(err) { showToast("Gặp lỗi", "error"); }
    });

    DOMElements.adminChatInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') DOMElements.adminSendChatBtn.click();
    });

    function initSocket() {
        if(typeof io === 'undefined') return;
        State.socket = io({ auth: { token: State.token }});
        State.socket.on('new_message', (msg) => {
            const fromId = typeof msg.from === 'object' ? msg.from._id : msg.from;
            if(State.activeChatUserId === fromId) {
                appendAdminMessage(msg);
            } else {
                showToast("Tin nhắn mới từ Khách hàng!", "success");
                const chatTab = document.querySelector('[data-tab="chat"]');
                if(!chatTab.innerHTML.includes('red-badge')) {
                    chatTab.innerHTML += ' <span class="red-badge" style="background:#EF4444; color:white; border-radius:50%; padding:2px 6px; font-size:10px; margin-left:5px;">Mới</span>';
                }
            }
            loadChatList();
        });
    }

    // Boot
    verifyAdmin();
});
