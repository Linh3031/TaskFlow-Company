// Version 9.1 - FIX LOGIN NULL ERROR

const firebaseConfig = {
  apiKey: "AIzaSyDqNsRClI9_ygv-FLn1MeFWxa8DTscu8lI",
  authDomain: "taskflow-company-41ab3.firebaseapp.com",
  projectId: "taskflow-company-41ab3",
  storageBucket: "taskflow-company-41ab3.firebasestorage.app",
  messagingSenderId: "360187172258",
  appId: "1:360187172258:web:2a304a34c222c202d64efb"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const DEFAULT_TEMPLATE = {
    warehouse: [
        { time: "08:00", title: "Báo cáo Online (ERP + GHQĐT) BC Group Kho" },
        { time: "08:00", title: "Chụp hình 8NTTT BC Group Kho" },
        { time: "08:00", title: "Lấy ĐT trong tủ đem ra tủ Phone (IP và SS)" },
        { time: "08:00", title: "In Popup (Trên Group in giá PG gửi)" },
        { time: "08:00", title: "Kiểm tra phiếu chuyển kho/ nhập đổi" },
        { time: "08:00", title: "Xử lý CVST quản lý yêu cầu" },
        { time: "09:00", title: "Báo cáo Online (ERP + GHQĐT) BC Group Kho" },
        { time: "09:00", title: "Nhập hàng NCC" },
        { time: "09:00", title: "Chuyển hàng lỗi (Nhận chuyển luôn không bàn giao)" },
        { time: "11:00", title: "Báo cáo Online (ERP + GHQĐT) BC Group Kho" },
        { time: "11:00", title: "Trưng bày Laptop Full" },
        { time: "11:00", title: "Kiểm tra và check nhận hàng kho khác chuyển về" },
        { time: "14:00", title: "Báo cáo Online (ERP + GHQĐT) BC Group Kho" },
        { time: "14:00", title: "Dọn dẹp khu vực sau lưng HTKT (Hàng NCC)" },
        { time: "15:00", title: "Báo cáo Online (ERP + GHQĐT) BC Group Kho (Ca chiều)" },
        { time: "15:00", title: "Đồng kiểm hàng NCC (Nhất Tín), check nhận" },
        { time: "15:00", title: "Chuyển phụ kiện lỗi (T2, T5)" },
        { time: "15:00", title: "Khui hàng trưng bày khu vực hàng ĐSĐ" },
        { time: "15:00", title: "Check mail xử lý công việc (nếu có)" },
        { time: "15:00", title: "Up hình máy cũ điện thoại + Table" },
        { time: "15:00", title: "Dọn dẹp khu vực sau lưng HTKT" },
        { time: "21:30", title: "Báo cáo Online (ERP + GHQĐT) BC Group Kho" },
        { time: "21:30", title: "Lấy ĐT trong tủ SS và IP cất vào tủ bí mật" },
        { time: "21:30", title: "Niêm phong tủ Phone và Đồng hồ" },
        { time: "21:30", title: "Niêm phong và khóa 3 cửa kho điện máy" },
        { time: "21:30", title: "Tắt đèn nhà vệ sinh" }
    ],
    cashier: [
        { time: "08:00", title: "Kiểm đếm tiền mặt đầu ca" },
        { time: "12:00", title: "Nộp tiền về ngân hàng" },
        { time: "21:30", title: "Chốt ca, in báo cáo kết toán" }
    ]
};

let currentUser = null;
let currentTasks = []; let taskTemplate = {}; 
let pendingTaskId = null; let unsubscribeTasks = null;

function init() { checkLoginStatus(); setupEventListeners(); }
function safeString(val) { return (val === undefined || val === null) ? '' : String(val).trim(); }
function getTodayStr() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
function formatDateTime(isoStr) {
    if(!isoStr) return "";
    const d = new Date(isoStr);
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    const mon = (d.getMonth()+1).toString().padStart(2, '0');
    return `${h}:${m} - ${day}/${mon}`;
}

async function login(u, p) {
    const cleanU = safeString(u).toLowerCase();
    const cleanP = safeString(p);
    if (cleanU === 'reset' && cleanP === '123456') {
        if(confirm("⚠ RESET TOÀN BỘ HÔM NAY?")) {
            await db.collection('settings').doc('template').delete();
            const today = getTodayStr();
            const snapshot = await db.collection('tasks').where('date', '==', today).get();
            const batch = db.batch();
            snapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            alert("✅ Đã reset. Hãy đăng nhập Admin (Linh-3031).");
            location.reload();
        }
        return;
    }
    document.getElementById('login-error').textContent = 'Đang kiểm tra...';
    try {
        const snapshot = await db.collection('users').where('username_idx', '==', cleanU).get();
        if (snapshot.empty) { document.getElementById('login-error').textContent = 'User không tồn tại!'; return; }
        let foundUser = null;
        snapshot.forEach(doc => { if (safeString(doc.data().pass) === cleanP) foundUser = doc.data(); });
        if (foundUser) {
            currentUser = foundUser;
            localStorage.setItem('taskflow_user', JSON.stringify(foundUser));
            location.reload();
        } else { document.getElementById('login-error').textContent = 'Sai mật khẩu!'; }
    } catch (err) { document.getElementById('login-error').textContent = 'Lỗi mạng: ' + err.message; }
}

function checkLoginStatus() {
    const saved = localStorage.getItem('taskflow_user');
    if (saved) { currentUser = JSON.parse(saved); renderUserInfo(); showMainApp(); subscribeToRealtimeData(); }
    else { showLoginScreen(); }
}

function subscribeToRealtimeData() {
    const today = getTodayStr();
    db.collection('settings').doc('template').onSnapshot(doc => {
        if (doc.exists) taskTemplate = doc.data();
        else { taskTemplate = DEFAULT_TEMPLATE; if (currentUser && currentUser.role === 'admin') saveTaskTemplateToCloud(); }
    });
    unsubscribeTasks = db.collection('tasks').where('date', '==', today).onSnapshot(snapshot => {
        const tasksFromCloud = [];
        snapshot.forEach(doc => tasksFromCloud.push({ id: doc.id, ...doc.data() }));
        currentTasks = tasksFromCloud;
        if (currentTasks.length === 0 && currentUser && currentUser.role === 'admin') initializeDailyTasks();
        const activeBtn = document.querySelector('.tab-btn.active');
        if(activeBtn) renderTasks(activeBtn.dataset.tab);
    });
}

function initializeDailyTasks() {
    const today = getTodayStr();
    const batch = db.batch();
    ['warehouse', 'cashier'].forEach(type => {
        if (taskTemplate[type]) {
            taskTemplate[type].forEach(item => {
                const title = typeof item === 'object' ? item.title : item;
                const time = typeof item === 'object' ? item.time : "00:00";
                const newRef = db.collection('tasks').doc();
                batch.set(newRef, {
                    type: type, title: title, timeSlot: time,
                    completed: false, completedBy: null, time: null, note: '',
                    createdBy: 'System', date: today, timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
        }
    });
    batch.commit();
}

function renderTasks(type) {
    const container = document.getElementById(`list-${type}`);
    if(!container) return;
    container.innerHTML = '';
    const tasks = currentTasks.filter(t => t.type === type);
    document.getElementById(`count-${type}`).textContent = `${tasks.filter(t => !t.completed).length} chưa xong`;

    tasks.sort((a, b) => {
        if (type === 'handover') {
            if (a.completed !== b.completed) return a.completed - b.completed;
            if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
            if (a.deadline && !b.deadline) return -1;
            if (!a.deadline && b.deadline) return 1;
            return (b.timestamp && a.timestamp) ? b.timestamp - a.timestamp : 0;
        } else {
            const timeA = a.timeSlot || "00:00";
            const timeB = b.timeSlot || "00:00";
            if (timeA !== timeB) return timeA.localeCompare(timeB);
            return a.completed - b.completed;
        }
    });

    let lastTimeSlot = null;
    tasks.forEach(task => {
        const currentTime = task.timeSlot || "Khác";
        if (type !== 'handover' && currentTime !== lastTimeSlot) {
            const header = document.createElement('div');
            header.style.cssText = "background:#e0f7fa; color:#006064; padding:6px 15px; border-radius:8px; margin:15px 0 5px 0; font-weight:bold; font-size:0.9rem; display:flex; align-items:center; gap:5px;";
            header.innerHTML = `<span class="material-icons-round" style="font-size:16px">schedule</span> ${currentTime}`;
            container.appendChild(header);
            lastTimeSlot = currentTime;
        }

        const el = document.createElement('div');
        el.className = `task-item ${task.completed ? 'completed' : ''}`;
        el.setAttribute('data-type', type);
        el.onclick = () => { if(task.completed) undoTask(task.id); else openModal(task); };

        let meta = '';
        if (task.type === 'handover' && task.deadline && !task.completed) {
            meta += `<span class="deadline-tag"><span class="material-icons-round" style="font-size:12px">alarm</span> Hạn: ${formatDateTime(task.deadline)}</span> `;
        }
        if (task.createdBy && task.createdBy !== 'System') meta += `<span class="creator-tag">${task.createdBy}</span> `;
        if(task.completed) meta += `<span class="done-tag"><span class="material-icons-round" style="font-size:14px">check_circle</span> ${task.completedBy} • ${task.time}</span>`;
        
        let note = task.note ? `<div class="task-note-display"><span>${task.note}</span></div>` : '';

        el.innerHTML = `<div class="checkbox-circle"></div><div class="task-content"><div class="task-title">${task.title}</div><div class="task-meta">${meta}</div>${note}</div>`;
        container.appendChild(el);
    });
}

function addHandoverTask() {
    const val = document.getElementById('new-handover-task').value.trim();
    const deadlineVal = document.getElementById('new-handover-deadline').value;
    if (val) {
        db.collection('tasks').add({
            type: 'handover', title: val, completed: false, completedBy: null, note: '', time: null,
            createdBy: currentUser.name || currentUser.username, deadline: deadlineVal,
            date: getTodayStr(), timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('new-handover-task').value = '';
        document.getElementById('new-handover-deadline').value = '';
    }
}

function handleExcelUpload(event) {
    const file = event.target.files[0]; if (!file) return; event.target.value = ''; alert("Đang đồng bộ...");
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result); const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]]; const rawData = XLSX.utils.sheet_to_json(sheet);
            const batch = db.batch(); let count = 0;
            rawData.forEach(row => {
                const nRow = {}; Object.keys(row).forEach(k => nRow[k.toLowerCase().trim()] = row[k]);
                const uName = safeString(nRow.username || nRow.user);
                if(uName) {
                    const userRef = db.collection('users').doc(uName.toLowerCase());
                    batch.set(userRef, { username: uName, username_idx: uName.toLowerCase(), pass: safeString(nRow.pass || nRow.password), role: safeString(nRow.role).toLowerCase() || 'staff', name: nRow.name ? safeString(nRow.name) : uName });
                    count++;
                }
            });
            await batch.commit(); alert(`✅ Xong! Đồng bộ ${count} user.`); location.reload();
        } catch (err) { alert("Lỗi: " + err.message); }
    }; reader.readAsArrayBuffer(file);
}

function confirmCompleteTask() {
    if (!pendingTaskId) return;
    const d = new Date();
    db.collection('tasks').doc(pendingTaskId).update({
        completed: true, completedBy: currentUser.name || currentUser.username,
        time: `${d.getHours()}:${d.getMinutes()<10?'0':''}${d.getMinutes()}`,
        note: document.getElementById('task-note-input').value.trim()
    });
    closeModal();
}
function undoTask(id) { if(confirm('Hoàn tác?')) db.collection('tasks').doc(id).update({ completed: false, completedBy: null, time: null, note: '' }); }
function saveTaskTemplateToCloud() { db.collection('settings').doc('template').set(taskTemplate); }
function addTemplateTask() {
    const type = document.getElementById('admin-list-select').value;
    const titleVal = document.getElementById('admin-new-task').value.trim();
    const timeVal = document.getElementById('admin-new-time').value.trim() || "08:00";
    if(titleVal) {
        if(!taskTemplate[type]) taskTemplate[type] = [];
        taskTemplate[type].push({ title: titleVal, time: timeVal });
        taskTemplate[type].sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));
        saveTaskTemplateToCloud();
        document.getElementById('admin-new-task').value = '';
        renderAdminTaskList();
    }
}
window.removeTemplateTask = function(type, index) { if(confirm('Xóa?')) { taskTemplate[type].splice(index, 1); saveTaskTemplateToCloud(); renderAdminTaskList(); } };
function renderAdminTaskList() {
    const type = document.getElementById('admin-list-select').value;
    const list = document.getElementById('admin-task-list');
    list.innerHTML = '';
    if(taskTemplate[type]) {
        taskTemplate[type].forEach((item, i) => {
            const title = typeof item === 'object' ? item.title : item;
            const time = typeof item === 'object' ? item.time : "---";
            list.innerHTML += `<li style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee; align-items:center; background:white;"><div style="display:flex; gap:10px; align-items:center;"><span style="background:#eee; padding:2px 6px; border-radius:4px; font-size:0.8rem; font-weight:bold;">${time}</span><span>${title}</span></div><button onclick="removeTemplateTask('${type}',${i})" style="color:red; border:none; background:none; cursor:pointer;"><span class="material-icons-round">delete</span></button></li>`;
        });
    }
}
function openModal(task) { pendingTaskId = task.id; document.getElementById('modal-task-title').textContent = task.title; document.getElementById('task-note-input').value = ''; document.getElementById('modal-complete').classList.remove('hidden'); }
function closeModal() { document.getElementById('modal-complete').classList.add('hidden'); pendingTaskId = null; }

// FIX LỖI Ở ĐÂY: Xóa dòng tìm 'user-role' đi vì HTML không còn nữa
function renderUserInfo() { 
    const dName = currentUser.name || currentUser.username; 
    document.getElementById('display-username').textContent = dName; 
    document.getElementById('user-avatar').textContent = dName.charAt(0).toUpperCase(); 
    // Xóa dòng này đi để không bị lỗi null
    // document.getElementById('user-role').textContent ... 
    
    if(currentUser.role === 'admin') document.getElementById('admin-btn').classList.remove('hidden'); 
}

function showLoginScreen() { document.getElementById('login-screen').classList.remove('hidden'); document.getElementById('main-app').classList.add('hidden'); }
function showMainApp() { document.getElementById('login-screen').classList.add('hidden'); document.getElementById('main-app').classList.remove('hidden'); }
function logout() { localStorage.removeItem('taskflow_user'); if (unsubscribeTasks) unsubscribeTasks(); location.reload(); }
function setupEventListeners() {
    document.getElementById('login-form').addEventListener('submit', e => { e.preventDefault(); login(document.getElementById('username').value, document.getElementById('password').value); });
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        renderTasks(btn.dataset.tab);
    }));
    document.getElementById('excel-input').addEventListener('change', handleExcelUpload);
    document.getElementById('btn-confirm-modal').addEventListener('click', confirmCompleteTask);
    document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
    document.getElementById('btn-add-handover').addEventListener('click', addHandoverTask);
    document.getElementById('admin-btn').addEventListener('click', () => { document.getElementById('modal-settings').classList.remove('hidden'); renderAdminTaskList(); });
    document.getElementById('btn-close-settings').addEventListener('click', () => document.getElementById('modal-settings').classList.add('hidden'));
    document.getElementById('admin-list-select').addEventListener('change', renderAdminTaskList);
    document.getElementById('admin-add-task-btn').addEventListener('click', addTemplateTask);
}
init();