/* ==========================================================
   1. GLOBAL VARIABLES & CONFIG
   ========================================================== */
let selectedRole = 'siswa';
let registerRole = 'siswa'; // Default ke siswa agar aman
let quizTimer; 

const firebaseConfig = {
    apiKey: "AIzaSyC8-ugSgkGk37dNP-htNVlB8FG5NkE2p4U",
    authDomain: "edusmart-8696e.firebaseapp.com",
    projectId: "edusmart-8696e",
    storageBucket: "edusmart-8696e.firebasestorage.app",
    messagingSenderId: "600335013389",
    appId: "1:600335013389:web:2ca195b7593cd76455e744",
    measurementId: "G-MGY3W2SJ5X"
};  

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

/* ==========================================================
   2. AUTH FUNCTIONS (LOGIN & REGISTER)
   ========================================================== */

window.setRole = function(role) { 
    selectedRole = role; 
    document.querySelectorAll('#roleSwitch .role-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.role === role);
    });
};

window.setRegisterRole = function(role) {
    registerRole = role;
    document.querySelectorAll('#registerRoleSwitch .role-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('onclick').includes(role));
    });
};

window.register = async function() {
    const fullName = document.getElementById('fullName')?.value.trim();
    const email = document.getElementById('registerEmail')?.value.trim();
    const pass = document.getElementById('regPass')?.value;
    
    if (!fullName || !email || !pass) return alert('Data wajib lengkap.');
    
    const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9]).{8,}$/;
    if (!passwordRegex.test(pass)) {
        return alert("Password wajib 8+ karakter, mengandung Angka & Huruf Besar.");
    }

    try {
        await db.collection("users").add({
            nama_lengkap: fullName,
            email: email,
            password: pass, 
            role: registerRole,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert(`Pendaftaran Berhasil sebagai ${registerRole}!`);
        window.showLogin(); 
    } catch (e) { alert("Gagal simpan data: " + e.message); }
};

window.login = async function() {
    const email = document.getElementById('loginEmail')?.value.trim();
    const pass = document.getElementById('loginPass')?.value;
    if (!email || !pass) return alert("Email/Password kosong.");

    try {
        const snapshot = await db.collection("users")
            .where("email", "==", email)
            .where("password", "==", pass)
            .where("role", "==", selectedRole)
            .get();

        if (snapshot.empty) return alert("Login Gagal: Akun tidak ditemukan atau Role salah.");

        snapshot.forEach(doc => {
        const data = doc.data();

        localStorage.setItem('edusmartUser', JSON.stringify({
            nama_lengkap: data.nama_lengkap || data.fullName || data.name || "Tidak ada nama",
            email: data.email,
            role: data.role
        }));
        });
        window.location.href = 'dashboard.html';
    } catch (e) { alert("Error koneksi: " + e.message); }
};

/* ==========================================================
   3. UI NAVIGATION (FORM TOGGLE)
   ========================================================== */
window.showRegister = function() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
};

window.showLogin = function() {
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
};

window.togglePass = function(id, btn) {
    const input = document.getElementById(id);
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🔒';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
};

/* ==========================================================
   4. SISTEM MATERI & KELAS
   ========================================================== */
function getCurrentUser() {
    return JSON.parse(localStorage.getItem('edusmartUser') || '{}');
}

function isGuru() {
    const user = getCurrentUser();
    return user.role === 'guru';
}

window.toggleModal = function(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'flex';
    }
};

window.initMateriPage = function() {
    const user = getCurrentUser();
    const actionBtn = document.getElementById('featureAction');

    if (actionBtn) {
        if (user.role === 'guru') {
            actionBtn.style.display = 'inline-flex';
            actionBtn.onclick = function () {
                toggleModal('modalTambahMateri');
            };
        } else {
            actionBtn.style.display = 'none';
        }
    }

    muatMateri();
};

window.muatMateri = async function() {
    const grid = document.getElementById('materiGrid');
    if (!grid) return;

    const user = getCurrentUser();

    try {
        const snapshot = await db.collection("materi").orderBy("createdAt", "desc").get();
        grid.innerHTML = "";

        if (snapshot.empty) {
            grid.innerHTML = `
                <article class="card-subject">
                    <div class="subject-tag">BELUM ADA</div>
                    <h3>Belum ada materi</h3>
                    <p>Materi akan tampil di sini setelah ditambahkan oleh guru.</p>
                </article>
            `;
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            const id = doc.id;
            const isOwner = user.role === 'guru' && user.email === data.email_pengunggah;

            grid.innerHTML += `
                <article class="card-subject">
                    <div class="subject-tag">${data.kategori || 'Materi'}</div>
                    <h3>${data.judul || '-'}</h3>
                    <p>${data.deskripsi || '-'}</p>

                    <div class="card-footer-row" style="margin-top:16px; display:flex; justify-content:space-between; align-items:center;">
                        <a href="${data.link_sumber || '#'}" target="_blank" class="btn-buka">Buka</a>
                        ${isOwner ? `
                            <button
                                type="button"
                                onclick="hapusMateri('${id}')"
                                style="cursor:pointer; border:none; background:none; font-size:20px;">
                                🗑️
                            </button>
                        ` : ''}
                    </div>
                </article>
            `;
        });
    } catch (e) {
        console.error("Gagal muat materi:", e);
        grid.innerHTML = `
            <article class="card-subject">
                <div class="subject-tag">ERROR</div>
                <h3>Gagal memuat materi</h3>
                <p>Periksa koneksi atau konfigurasi Firebase Anda.</p>
            </article>
        `;
    }
};

window.simpanMateriBaru = async function() {
    const user = getCurrentUser();

    if (user.role !== 'guru') {
        alert("Hanya guru yang dapat menambahkan materi.");
        return;
    }

    const judul = document.getElementById('inputJudulMateri')?.value.trim();
    const deskripsi = document.getElementById('inputDeskripsiMateri')?.value.trim();
    const kategori = document.getElementById('inputKategoriMateri')?.value;
    const link = document.getElementById('inputLinkMateri')?.value.trim();

    if (!judul || !deskripsi || !kategori || !link) {
        alert("Semua field materi wajib diisi.");
        return;
    }

    try {
        await db.collection("materi").add({
            judul: judul,
            deskripsi: deskripsi,
            kategori: kategori,
            link_sumber: link,
            email_pengunggah: user.email,
            nama_pengunggah: user.name || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Materi berhasil ditambahkan.");
        bersihkanFormMateri();
        toggleModal('modalTambahMateri');
        muatMateri();
    } catch (e) {
        console.error("Gagal simpan materi:", e);
        alert("Gagal menyimpan materi.");
    }
};

window.bersihkanFormMateri = function() {
    const judul = document.getElementById('inputJudulMateri');
    const deskripsi = document.getElementById('inputDeskripsiMateri');
    const kategori = document.getElementById('inputKategoriMateri');
    const link = document.getElementById('inputLinkMateri');

    if (judul) judul.value = '';
    if (deskripsi) deskripsi.value = '';
    if (kategori) kategori.value = 'Modul';
    if (link) link.value = '';
};

window.hapusMateri = async function(id) {
    const user = getCurrentUser();

    if (user.role !== 'guru') {
        alert("Hanya guru yang dapat menghapus materi.");
        return;
    }

    const konfirmasi = confirm("Yakin ingin menghapus materi ini?");
    if (!konfirmasi) return;

    try {
        await db.collection("materi").doc(id).delete();
        alert("Materi berhasil dihapus.");
        muatMateri();
    } catch (e) {
        console.error("Gagal hapus materi:", e);
        alert("Gagal menghapus materi.");
    }
};

/* ==========================================================
   5. SISTEM QUIZ
   ========================================================== */
window.simpanQuizBaru = async function() {
    const user = JSON.parse(localStorage.getItem('edusmartUser'));
    const data = {
        judul_quiz: document.getElementById('quizTitle').value,
        kode_kelas: document.getElementById('quizClassCode').value.toUpperCase(),
        durasi: parseInt(document.getElementById('quizDuration').value) || 10,
        pembuat: user.email,
        pertanyaan: [{
            soal: document.getElementById('soalText').value,
            a: document.getElementById('optA').value,
            b: document.getElementById('optB').value,
            c: document.getElementById('optC').value,
            kunci: document.getElementById('kunciJawaban').value
        }],
        hasil_siswa: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection("quizzes").add(data);
        alert("Quiz Terbit!");
        location.reload();
    } catch (e) { alert("Gagal."); }
};

/* ==========================================================
   6. INITIALIZATION
   ========================================================== */
window.toggleModal = function(id) { 
    const m = document.getElementById(id);
    if(m) m.classList.toggle('hidden'); 
};

document.addEventListener('DOMContentLoaded', () => {
    const isDashboard = window.location.pathname.includes('dashboard.html') || window.location.pathname.includes('kelas.html');
    
    if (isDashboard) {
        const userData = localStorage.getItem('edusmartUser');
        if (!userData) {
            window.location.href = 'index.html';
            return;
        }
        muatMateri();
        initKelasUI();
    }
});

function initProfilePage() {
  const user = JSON.parse(localStorage.getItem('edusmartUser'));

  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const name = user.nama_lengkap && user.nama_lengkap !== ""
    ? user.nama_lengkap
    : "Tidak ada nama";

  document.getElementById("profileName").textContent = name;
  document.getElementById("detailName").textContent = name;

  document.getElementById("profileRole").textContent = user.role.toUpperCase();
  document.getElementById("detailEmail").textContent = user.email;
  document.getElementById("detailRole").textContent = user.role;

  document.getElementById("avatarBox").textContent = name.substring(0,2).toUpperCase();
}

function logout() {
  localStorage.removeItem("edusmartUser");
  window.location.href = "index.html";
}