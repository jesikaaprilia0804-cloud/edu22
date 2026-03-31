/* ==========================================================
   1. GLOBAL VARIABLES & CONFIG
   ========================================================== */
let selectedRole = 'siswa';
let registerRole = 'siswa';
let quizTimer = null;
let draftSoalQuiz = [];

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
   2. HELPER
   ========================================================== */
function getCurrentUser() {
    return JSON.parse(localStorage.getItem('edusmartUser') || '{}');
}

function isGuru() {
    return getCurrentUser().role === 'guru';
}

function isSiswa() {
    return getCurrentUser().role === 'siswa';
}

function getNamaUser(user) {
    return user.nama_lengkap || user.fullName || user.name || "Tanpa Nama";
}

function getUrlParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

function escapeHtml(text) {
    if (!text) return "";
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatTanggal(ts) {
    if (!ts) return "-";
    try {
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });
    } catch {
        try {
            return new Date(ts).toLocaleDateString("id-ID");
        } catch {
            return "-";
        }
    }
}

window.toggleModal = function(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
};

window.logout = function() {
    localStorage.removeItem("edusmartUser");
    window.location.href = "index.html";
};

window.readFileAsDataURL = function(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = err => reject(err);
        reader.readAsDataURL(file);
    });
};

/* ==========================================================
   3. AUTH FUNCTIONS
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
        b.classList.toggle('active', b.getAttribute('onclick')?.includes(role));
    });
};

window.register = async function() {
    const fullName = document.getElementById('fullName')?.value.trim();
    const email = document.getElementById('registerEmail')?.value.trim();
    const pass = document.getElementById('regPass')?.value;

    if (!fullName || !email || !pass) {
        return alert('Data wajib lengkap.');
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9]).{8,}$/;
    if (!passwordRegex.test(pass)) {
        return alert("Password wajib 8+ karakter, mengandung angka & huruf besar.");
    }

    try {
        await db.collection("users").add({
            nama_lengkap: fullName,
            email: email,
            password: pass,
            role: registerRole,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert(`Pendaftaran berhasil sebagai ${registerRole}!`);
        window.showLogin();
    } catch (e) {
        alert("Gagal simpan data: " + e.message);
    }
};

window.login = async function() {
    const email = document.getElementById('loginEmail')?.value.trim();
    const pass = document.getElementById('loginPass')?.value;

    if (!email || !pass) {
        return alert("Email/Password kosong.");
    }

    try {
        const snapshot = await db.collection("users")
            .where("email", "==", email)
            .where("password", "==", pass)
            .where("role", "==", selectedRole)
            .get();

        if (snapshot.empty) {
            return alert("Login gagal: akun tidak ditemukan atau role salah.");
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            localStorage.setItem('edusmartUser', JSON.stringify({
                nama_lengkap: data.nama_lengkap || data.fullName || data.name || "Tidak ada nama",
                email: data.email,
                role: data.role
            }));
        });

        window.location.href = 'dashboard.html';
    } catch (e) {
        alert("Error koneksi: " + e.message);
    }
};

/* ==========================================================
   4. UI NAVIGATION
   ========================================================== */
window.showRegister = function() {
    document.getElementById('loginForm')?.classList.add('hidden');
    document.getElementById('registerForm')?.classList.remove('hidden');
};

window.showLogin = function() {
    document.getElementById('registerForm')?.classList.add('hidden');
    document.getElementById('loginForm')?.classList.remove('hidden');
};

window.togglePass = function(id, btn) {
    const input = document.getElementById(id);
    if (!input) return;

    if (input.type === 'password') {
        input.type = 'text';
        if (btn) btn.textContent = '🔒';
    } else {
        input.type = 'password';
        if (btn) btn.textContent = '👁️';
    }
};

/* ==========================================================
   5. KELAS
   ========================================================== */
window.initKelasPage = async function() {
    const user = getCurrentUser();
    if (!user.email) {
        window.location.href = "index.html";
        return;
    }

    const roleLabel = document.getElementById("kelasRoleLabel");
    const guruControls = document.getElementById("kelasGuruControls");
    const siswaControls = document.getElementById("kelasSiswaControls");

    if (roleLabel) {
        roleLabel.textContent = user.role === "guru" ? "Kelola kelas" : "Akses kelas";
    }

    if (guruControls) guruControls.style.display = isGuru() ? "flex" : "none";
    if (siswaControls) siswaControls.style.display = isSiswa() ? "flex" : "none";

    await muatDaftarKelas();
};

window.simpanKelasBaru = async function() {
    if (!isGuru()) return alert("Hanya guru yang dapat membuat kelas.");

    const user = getCurrentUser();
    const nama = document.getElementById('inputNamaKelas')?.value.trim();
    const aktif = document.getElementById('inputStatusKelas')?.checked ?? true;
    const kode = Math.random().toString(36).substring(2, 8).toUpperCase();

    if (!nama) return alert("Nama kelas wajib diisi.");

    try {
        await db.collection("kelas").add({
            nama_kelas: nama,
            kode_kelas: kode,
            guru_email: user.email,
            guru_nama: getNamaUser(user),
            status_aktif: aktif,
            siswa_terdaftar: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert(`Kelas berhasil dibuat. Kode kelas: ${kode}`);
        if (document.getElementById('inputNamaKelas')) {
            document.getElementById('inputNamaKelas').value = '';
        }
        toggleModal('modalTambahKelas');
        muatDaftarKelas();
    } catch (e) {
        console.error(e);
        alert("Gagal membuat kelas.");
    }
};

window.gabungKeKelas = async function() {
    if (!isSiswa()) return alert("Hanya siswa yang dapat bergabung ke kelas.");

    const user = getCurrentUser();
    const kodeInput = document.getElementById('inputKodeGabung')?.value.trim().toUpperCase();

    if (!kodeInput) return alert("Masukkan kode kelas.");

    try {
        const snapshot = await db.collection("kelas")
            .where("kode_kelas", "==", kodeInput)
            .get();

        if (snapshot.empty) return alert("Kode kelas tidak ditemukan.");

        const doc = snapshot.docs[0];
        const data = doc.data();
        const siswa = data.siswa_terdaftar || [];

        const sudahGabung = siswa.some(item => item.email === user.email);
        if (sudahGabung) return alert("Anda sudah tergabung di kelas ini.");

        siswa.push({
            nama: getNamaUser(user),
            email: user.email
        });

        await db.collection("kelas").doc(doc.id).update({
            siswa_terdaftar: siswa
        });

        alert("Berhasil bergabung ke kelas.");
        if (document.getElementById('inputKodeGabung')) {
            document.getElementById('inputKodeGabung').value = '';
        }
        muatDaftarKelas();
    } catch (e) {
        console.error(e);
        alert("Gagal bergabung ke kelas.");
    }
};

window.muatDaftarKelas = async function() {
    const grid = document.getElementById("kelasGrid");
    if (!grid) return;

    const user = getCurrentUser();

    try {
        const snapshot = await db.collection("kelas").orderBy("createdAt", "desc").get();
        grid.innerHTML = "";

        if (snapshot.empty) {
            grid.innerHTML = `
                <article class="card-subject">
                    <div class="subject-tag">BELUM ADA</div>
                    <h3>Belum ada kelas</h3>
                    <p>Kelas akan tampil di sini.</p>
            
                </article>
            `;
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            const isPemilik = isGuru() && user.email === data.guru_email;
            const siswa = data.siswa_terdaftar || [];
            const ikut = siswa.some(item => item.email === user.email);

            if (isGuru() && !isPemilik) return;
            if (isSiswa() && !ikut) return;

            grid.innerHTML += `
                <article class="card-subject">
                    <div class="subject-tag">${data.status_aktif ? 'KELAS AKTIF' : 'KELAS NONAKTIF'}</div>
                    <h3>${escapeHtml(data.nama_kelas)}</h3>
                    <p><strong>Kode:</strong> ${escapeHtml(data.kode_kelas)}</p>
                    <p><strong>Guru:</strong> ${escapeHtml(data.guru_nama || '-')}</p>
                    <p><strong>Jumlah siswa:</strong> ${siswa.length}</p>

                    <div class="card-footer-row" style="margin-top:16px; display:flex; gap:10px; flex-wrap:wrap;">
                        <a href="materi.html?kelas_id=${doc.id}" class="btn-buka">Materi</a>
                        <button class="btn-buka" onclick="lihatDetailKelas('${doc.id}')">Detail Kelas</button>
                        ${isPemilik ? `<button class="ghost-btn" onclick="hapusKelas('${doc.id}')">Hapus</button>` : ''}
                        ${isGuru() ? `
                    <button class="ghost-btn" onclick="lihatSiswaKelas('${doc.id}')">
                        Lihat Siswa
                    </button>
                ` : ""}
                    </div>
                </article>
            `;
        });

        if (grid.innerHTML.trim() === "") {
            grid.innerHTML = `
                <article class="card-subject">
                    <div class="subject-tag">INFO</div>
                    <h3>Tidak ada kelas</h3>
                    <p>${isGuru() ? 'Anda belum membuat kelas.' : 'Anda belum tergabung ke kelas manapun.'}</p>
                </article>
            `;
        }
    } catch (e) {
        console.error("Gagal memuat kelas:", e);
        grid.innerHTML = `
            <article class="card-subject">
                <div class="subject-tag">ERROR</div>
                <h3>Gagal memuat kelas</h3>
                <p>Periksa koneksi atau konfigurasi Firebase.</p>
            </article>
        `;
    }
};

window.hapusKelas = async function(id) {
    if (!isGuru()) return alert("Hanya guru yang dapat menghapus kelas.");

    const konfirmasi = confirm("Yakin ingin menghapus kelas ini?");
    if (!konfirmasi) return;

    try {
        await db.collection("kelas").doc(id).delete();
        alert("Kelas berhasil dihapus.");
        muatDaftarKelas();
    } catch (e) {
        console.error(e);
        alert("Gagal menghapus kelas.");
    }
};

window.lihatDetailKelas = function(id) {
    window.location.href = `kelas.html?kelas_id=${id}&tab=detail`;
};

/* ==========================================================
   6. DETAIL KELAS
   ========================================================== */
window.initDetailKelasPage = async function() {
    const user = getCurrentUser();
    if (!user.email) {
        window.location.href = "index.html";
        return;
    }

    const kelasId = getUrlParam("kelas_id");
    if (!kelasId) return;

    await muatInfoKelas(kelasId);
    await muatPengumuman(kelasId);
    await muatJadwal(kelasId);

    const pengumumanBtn = document.getElementById("btnTambahPengumuman");
    const jadwalBtn = document.getElementById("btnTambahJadwal");

    if (pengumumanBtn) pengumumanBtn.style.display = isGuru() ? "inline-flex" : "none";
    if (jadwalBtn) jadwalBtn.style.display = isGuru() ? "inline-flex" : "none";
};

window.muatInfoKelas = async function(kelasId) {
    try {
        const doc = await db.collection("kelas").doc(kelasId).get();
        if (!doc.exists) return;

        const data = doc.data();
        const title = document.getElementById("detailNamaKelas");
        const desc = document.getElementById("detailInfoKelas");

        if (title) title.textContent = data.nama_kelas || "Detail Kelas";
        if (desc) desc.textContent = `Kode: ${data.kode_kelas} • Guru: ${data.guru_nama || '-'} • Status: ${data.status_aktif ? 'Aktif' : 'Nonaktif'}`;
    } catch (e) {
        console.error("Gagal memuat info kelas:", e);
    }
};

window.simpanPengumumanBaru = async function() {
    if (!isGuru()) return alert("Hanya guru yang dapat membuat pengumuman.");

    const user = getCurrentUser();
    const kelasId = getUrlParam("kelas_id");
    const judul = document.getElementById("inputJudulPengumuman")?.value.trim();
    const isi = document.getElementById("inputIsiPengumuman")?.value.trim();

    if (!kelasId) return alert("kelas_id tidak ditemukan.");
    if (!judul || !isi) return alert("Judul dan isi pengumuman wajib diisi.");

    try {
        await db.collection("pengumuman").add({
            kelas_id: kelasId,
            judul,
            isi,
            dibuat_oleh_email: user.email,
            dibuat_oleh_nama: getNamaUser(user),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Pengumuman berhasil dibuat.");
        if (document.getElementById("inputJudulPengumuman")) document.getElementById("inputJudulPengumuman").value = "";
        if (document.getElementById("inputIsiPengumuman")) document.getElementById("inputIsiPengumuman").value = "";
        toggleModal("modalTambahPengumuman");
        await muatPengumuman(kelasId);
    } catch (e) {
        console.error("Gagal membuat pengumuman:", e);
        alert("Gagal membuat pengumuman.");
    }
};

window.simpanJadwalBaru = async function() {
    if (!isGuru()) return alert("Hanya guru yang dapat membuat jadwal.");

    const user = getCurrentUser();
    const kelasId = getUrlParam("kelas_id");
    const hari = document.getElementById("inputHariJadwal")?.value.trim();
    const jam = document.getElementById("inputJamJadwal")?.value.trim();
    const kegiatan = document.getElementById("inputKegiatanJadwal")?.value.trim();

    if (!kelasId) return alert("kelas_id tidak ditemukan.");
    if (!hari || !jam || !kegiatan) return alert("Hari, jam, dan kegiatan wajib diisi.");

    try {
        await db.collection("jadwal").add({
            kelas_id: kelasId,
            hari,
            jam,
            kegiatan,
            dibuat_oleh_email: user.email,
            dibuat_oleh_nama: getNamaUser(user),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Jadwal berhasil dibuat.");
        if (document.getElementById("inputHariJadwal")) document.getElementById("inputHariJadwal").value = "";
        if (document.getElementById("inputJamJadwal")) document.getElementById("inputJamJadwal").value = "";
        if (document.getElementById("inputKegiatanJadwal")) document.getElementById("inputKegiatanJadwal").value = "";
        toggleModal("modalTambahJadwal");
        await muatJadwal(kelasId);
    } catch (e) {
        console.error("Gagal membuat jadwal:", e);
        alert("Gagal membuat jadwal.");
    }
};

window.muatPengumuman = async function(kelasId) {
    const list = document.getElementById("pengumumanList");
    if (!list) return;

    try {
        const snapshot = await db.collection("pengumuman").where("kelas_id", "==", kelasId).get();
        const dataList = [];
        snapshot.forEach((doc) => dataList.push({ id: doc.id, ...doc.data() }));

        dataList.sort((a, b) => {
            const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return bTime - aTime;
        });

        list.innerHTML = "";

        if (!dataList.length) {
            list.innerHTML = `<p>Belum ada pengumuman.</p>`;
            return;
        }

        dataList.forEach((data) => {
            list.innerHTML += `
                <article class="card-subject">
                    <div class="subject-tag">PENGUMUMAN</div>
                    <h3>${escapeHtml(data.judul)}</h3>
                    <p>${escapeHtml(data.isi)}</p>
                    <small>${formatTanggal(data.createdAt)}</small>
                    ${isGuru() ? `<div style="margin-top:12px;"><button class="ghost-btn" onclick="hapusPengumuman('${data.id}')">Hapus</button></div>` : ''}
                </article>
            `;
        });
    } catch (e) {
        console.error("Gagal memuat pengumuman:", e);
        list.innerHTML = `<p>Gagal memuat pengumuman.</p>`;
    }
};

window.muatJadwal = async function(kelasId) {
    const list = document.getElementById("jadwalList");
    if (!list) return;

    try {
        const snapshot = await db.collection("jadwal").where("kelas_id", "==", kelasId).get();
        const dataList = [];
        snapshot.forEach((doc) => dataList.push({ id: doc.id, ...doc.data() }));

        dataList.sort((a, b) => {
            const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return bTime - aTime;
        });

        list.innerHTML = "";

        if (!dataList.length) {
            list.innerHTML = `<p>Belum ada jadwal.</p>`;
            return;
        }

        dataList.forEach((data) => {
            list.innerHTML += `
                <article class="card-subject">
                    <div class="subject-tag">${escapeHtml(data.hari)}</div>
                    <h3>${escapeHtml(data.jam)}</h3>
                    <p>${escapeHtml(data.kegiatan)}</p>
                    ${isGuru() ? `<div style="margin-top:12px;"><button class="ghost-btn" onclick="hapusJadwal('${data.id}')">Hapus</button></div>` : ''}
                </article>
            `;
        });
    } catch (e) {
        console.error("Gagal memuat jadwal:", e);
        list.innerHTML = `<p>Gagal memuat jadwal.</p>`;
    }
};

window.hapusPengumuman = async function(id) {
    if (!isGuru()) return;
    try {
        await db.collection("pengumuman").doc(id).delete();
        await muatPengumuman(getUrlParam("kelas_id"));
    } catch (e) {
        console.error("Gagal menghapus pengumuman:", e);
        alert("Gagal menghapus pengumuman.");
    }
};

window.hapusJadwal = async function(id) {
    if (!isGuru()) return;
    try {
        await db.collection("jadwal").doc(id).delete();
        await muatJadwal(getUrlParam("kelas_id"));
    } catch (e) {
        console.error("Gagal menghapus jadwal:", e);
        alert("Gagal menghapus jadwal.");
    }
};

/* ==========================================================
   7. MATERI
   ========================================================== */
window.cekKelasMilikGuru = async function(kelasId) {
    const user = getCurrentUser();
    if (!kelasId || !isGuru()) return false;

    try {
        const doc = await db.collection("kelas").doc(kelasId).get();
        if (!doc.exists) return false;
        return doc.data().guru_email === user.email;
    } catch (e) {
        console.error("Gagal cek kepemilikan kelas:", e);
        return false;
    }
};

window.cekSiswaIkutKelas = async function(kelasId) {
    const user = getCurrentUser();
    if (!kelasId || !isSiswa()) return false;

    try {
        const doc = await db.collection("kelas").doc(kelasId).get();
        if (!doc.exists) return false;
        const siswa = doc.data().siswa_terdaftar || [];
        return siswa.some(item => item.email === user.email);
    } catch (e) {
        console.error("Gagal cek keanggotaan kelas:", e);
        return false;
    }
};

window.bukaMateri = function(link, namaFile = "materi", tipeFile = "") {
    if (!link || link === "#") {
        alert("Materi tidak tersedia.");
        return;
    }

    try {
        if (!String(link).startsWith("data:")) {
            window.open(link, "_blank");
            return;
        }

        const previewWindow = window.open("", "_blank");
        if (!previewWindow) {
            alert("Popup diblokir browser. Izinkan popup untuk membuka materi.");
            return;
        }

        if (
            tipeFile.startsWith("image/") ||
            tipeFile === "application/pdf" ||
            tipeFile.startsWith("text/")
        ) {
            previewWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${namaFile}</title>
                    <style>
                        body {
                            margin: 0;
                            background: #f5f5f5;
                            font-family: Arial, sans-serif;
                        }
                        iframe, img {
                            width: 100%;
                            height: 100vh;
                            border: none;
                            background: white;
                            object-fit: contain;
                        }
                    </style>
                </head>
                <body>
                    ${
                        tipeFile.startsWith("image/")
                            ? `<img src="${link}" alt="${namaFile}">`
                            : `<iframe src="${link}"></iframe>`
                    }
                </body>
                </html>
            `);
            previewWindow.document.close();
            return;
        }

        const a = document.createElement("a");
        a.href = link;
        a.download = namaFile || "materi";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        previewWindow.close();
    } catch (e) {
        console.error("Gagal membuka materi:", e);
        alert("Gagal membuka materi.");
    }
};

window.bukaMateriById = async function(id) {
    try {
        const doc = await db.collection("materi").doc(id).get();
        if (!doc.exists) {
            alert("Materi tidak ditemukan.");
            return;
        }

        const data = doc.data();
        bukaMateri(
            data.link_sumber || "#",
            data.nama_file || data.judul || "materi",
            data.tipe_file || ""
        );
    } catch (e) {
        console.error("Gagal membuka materi dari ID:", e);
        alert("Gagal membuka materi.");
    }
};

window.initMateriPage = async function() {
    const user = getCurrentUser();
    if (!user.email) {
        window.location.href = "index.html";
        return;
    }

    const kelasId = getUrlParam("kelas_id");
    const controls = document.getElementById("materiControls");
    if (controls) controls.innerHTML = "";

    if (kelasId && isGuru()) {
        const milikGuru = await cekKelasMilikGuru(kelasId);
        if (milikGuru && controls) {
            controls.innerHTML = `
                <button class="ghost-btn" type="button" onclick="toggleModal('modalTambahMateri')">
                  Tambah Materi
                </button>
            `;
        }
    }

    if (kelasId && isSiswa()) {
        const ikutKelas = await cekSiswaIkutKelas(kelasId);
        if (!ikutKelas) {
            alert("Anda tidak memiliki akses ke materi kelas ini.");
            window.location.href = "kelas.html";
            return;
        }
    }

    await muatInfoHeaderMateri(kelasId);
    await muatMateri(kelasId);
};

window.muatInfoHeaderMateri = async function(kelasId) {
    const title = document.getElementById("featureTitle");
    const desc = document.getElementById("featureDescription");

    if (!kelasId) {
        if (title) title.textContent = "Materi pembelajaran";
        if (desc) {
            desc.textContent = isGuru()
                ? "Materi yang Anda unggah di kelas-kelas Anda akan tampil di sini."
                : "Materi dari kelas yang Anda ikuti akan tampil di sini.";
        }
        return;
    }

    try {
        const doc = await db.collection("kelas").doc(kelasId).get();
        if (!doc.exists) {
            if (title) title.textContent = "Kelas tidak ditemukan";
            if (desc) desc.textContent = "ID kelas tidak valid.";
            return;
        }

        const data = doc.data();
        if (title) title.textContent = `Materi - ${data.nama_kelas}`;
        if (desc) {
            desc.textContent = isGuru()
                ? "Kelola modul, video, dan ringkasan untuk kelas ini."
                : "Lihat modul, video, dan ringkasan yang diunggah guru untuk kelas ini.";
        }
    } catch (e) {
        console.error("Gagal memuat info header materi:", e);
    }
};

window.muatMateri = async function(kelasId = null) {
    const grid = document.getElementById("materiGrid");
    if (!grid) return;

    const user = getCurrentUser();

    try {
        let materiList = [];

        if (kelasId) {
            const snapshot = await db.collection("materi")
                .where("kelas_id", "==", kelasId)
                .get();

            snapshot.forEach((doc) => {
                materiList.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
        } else {
            if (isGuru()) {
                const snapshot = await db.collection("materi")
                    .where("email_pengunggah", "==", user.email)
                    .get();

                snapshot.forEach((doc) => {
                    materiList.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
            } else {
                const kelasSnap = await db.collection("kelas").get();
                const joinedClassIds = [];

                kelasSnap.forEach((doc) => {
                    const data = doc.data();
                    const siswa = data.siswa_terdaftar || [];
                    if (siswa.some(item => item.email === user.email)) {
                        joinedClassIds.push(doc.id);
                    }
                });

                const materiSnap = await db.collection("materi").get();
                materiSnap.forEach((doc) => {
                    const data = doc.data();
                    if (joinedClassIds.includes(data.kelas_id)) {
                        materiList.push({
                            id: doc.id,
                            ...data
                        });
                    }
                });
            }
        }

        materiList.sort((a, b) => {
            const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return bTime - aTime;
        });

        grid.innerHTML = "";

        if (!materiList.length) {
            grid.innerHTML = `
                <article class="card-subject">
                    <div class="subject-tag">BELUM ADA</div>
                    <h3>Belum ada materi</h3>
                    <p>${kelasId ? "Belum ada materi untuk kelas ini." : "Belum ada materi yang dapat diakses."}</p>
                </article>
            `;
            return;
        }

        materiList.forEach((data) => {
            const isOwner = isGuru() && user.email === data.email_pengunggah;
            const namaTampilan = data.nama_file ? `📎 ${escapeHtml(data.nama_file)}` : "Buka";

            grid.innerHTML += `
                <article class="card-subject">
                    <div class="subject-tag">${escapeHtml(data.kategori || "Materi")}</div>
                    <h3>${escapeHtml(data.judul || "-")}</h3>
                    <p>${escapeHtml(data.deskripsi || "-")}</p>
                    <small>
                        ${data.kelas_nama ? escapeHtml(data.kelas_nama) + " • " : ""}
                        ${formatTanggal(data.createdAt)}
                    </small>

                    <div class="card-footer-row" style="margin-top:16px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                        <button
                            type="button"
                            class="btn-buka"
                            onclick="bukaMateriById('${data.id}')"
                        >
                            ${namaTampilan}
                        </button>

                        ${isOwner ? `
                            <button type="button" onclick="hapusMateri('${data.id}')" style="cursor:pointer; border:none; background:none; font-size:20px;">
                                🗑️
                            </button>
                        ` : ""}
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
                <p>Periksa koneksi atau konfigurasi Firebase.</p>
            </article>
        `;
    }
};

window.simpanMateriBaru = async function() {
    const user = getCurrentUser();

    if (!isGuru()) return alert("Hanya guru yang dapat menambahkan materi.");

    const kelasId = getUrlParam("kelas_id");
    if (!kelasId) return alert("Materi hanya dapat ditambahkan dari halaman kelas.");

    const milikGuru = await cekKelasMilikGuru(kelasId);
    if (!milikGuru) return alert("Anda hanya dapat menambahkan materi ke kelas milik Anda.");

    const judul = document.getElementById("inputJudulMateri")?.value.trim();
    const deskripsi = document.getElementById("inputDeskripsiMateri")?.value.trim();
    const kategori = document.getElementById("inputKategoriMateri")?.value;
    const file = document.getElementById("inputFileMateri")?.files?.[0] || null;
    const linkManualRaw = document.getElementById("inputLinkMateri")?.value.trim();
    const linkManual = linkManualRaw === "-" ? "" : linkManualRaw;

    if (!judul || !deskripsi || !kategori) {
        return alert("Judul, deskripsi, dan kategori wajib diisi.");
    }

    if (!file && !linkManual) {
        return alert("Upload file atau isi link sumber.");
    }

    try {
        let kelasNama = "";
        const kelasDoc = await db.collection("kelas").doc(kelasId).get();
        if (kelasDoc.exists) kelasNama = kelasDoc.data().nama_kelas || "";

        let finalLink = linkManual || "";
        let namaFile = "";
        let tipeFile = "";
        let ukuranFile = 0;

        if (file) {
            const maxSize = 5000 * 1024;
            if (file.size > maxSize) {
                return alert("Ukuran file terlalu besar. Gunakan file maksimal 5 MB atau pakai link.");
            }

            const dataUrl = await readFileAsDataURL(file);
            finalLink = dataUrl;
            namaFile = file.name;
            tipeFile = file.type || "";
            ukuranFile = file.size || 0;
        }

        await db.collection("materi").add({
            kelas_id: kelasId,
            kelas_nama: kelasNama,
            judul,
            deskripsi,
            kategori,
            link_sumber: finalLink,
            nama_file: namaFile,
            tipe_file: tipeFile,
            ukuran_file: ukuranFile,
            email_pengunggah: user.email,
            nama_pengunggah: getNamaUser(user),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Materi berhasil ditambahkan.");
        bersihkanFormMateri();
        toggleModal("modalTambahMateri");
        muatMateri(kelasId);
    } catch (e) {
        console.error("DETAIL ERROR SIMPAN MATERI:", e);
        alert("Gagal menyimpan materi: " + (e.message || "Unknown error"));
    }
};

window.bersihkanFormMateri = function() {
    const judul = document.getElementById("inputJudulMateri");
    const deskripsi = document.getElementById("inputDeskripsiMateri");
    const kategori = document.getElementById("inputKategoriMateri");
    const link = document.getElementById("inputLinkMateri");
    const file = document.getElementById("inputFileMateri");

    if (judul) judul.value = "";
    if (deskripsi) deskripsi.value = "";
    if (kategori) kategori.value = "Modul";
    if (link) link.value = "";
    if (file) file.value = "";
};

window.hapusMateri = async function(id) {
    if (!isGuru()) return alert("Hanya guru yang dapat menghapus materi.");

    const konfirmasi = confirm("Yakin ingin menghapus materi ini?");
    if (!konfirmasi) return;

    try {
        await db.collection("materi").doc(id).delete();
        alert("Materi berhasil dihapus.");
        muatMateri(getUrlParam("kelas_id"));
    } catch (e) {
        console.error("Gagal hapus materi:", e);
        alert("Gagal menghapus materi.");
    }
};

/* ==========================================================
   8. QUIZ
   ========================================================== */
window.loadKelasUntukQuiz = async function() {
    const select = document.getElementById("quizKelasSelect");
    const user = getCurrentUser();

    if (!select || !isGuru()) return;

    try {
        const snapshot = await db.collection("kelas")
            .where("guru_email", "==", user.email)
            .get();

        const kelasList = [];
        snapshot.forEach((doc) => {
            kelasList.push({
                id: doc.id,
                ...doc.data()
            });
        });

        kelasList.sort((a, b) => {
            const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return bTime - aTime;
        });

        select.innerHTML = `<option value="">Pilih kelas</option>`;

        kelasList.forEach((kelas) => {
            select.innerHTML += `
                <option value="${kelas.id}">
                    ${escapeHtml(kelas.nama_kelas)} (${escapeHtml(kelas.kode_kelas || "-")})
                </option>
            `;
        });
    } catch (e) {
        console.error("Gagal memuat kelas untuk quiz:", e);
    }
};

window.getKelasYangDiikutiSiswa = async function() {
    const user = getCurrentUser();
    const joinedClassIds = [];

    if (!isSiswa()) return joinedClassIds;

    try {
        const kelasSnap = await db.collection("kelas").get();

        kelasSnap.forEach((doc) => {
            const data = doc.data();
            const siswa = data.siswa_terdaftar || [];
            const ikut = siswa.some(item => item.email === user.email);
            if (ikut) joinedClassIds.push(doc.id);
        });
    } catch (e) {
        console.error("Gagal mengambil kelas siswa:", e);
    }

    return joinedClassIds;
};

window.initQuizPage = async function() {
    const user = getCurrentUser();
    if (!user.email) {
        window.location.href = "index.html";
        return;
    }

    const btnCreateQuiz = document.getElementById("btnCreateQuiz");
    const scoreSection = document.getElementById("quizScoreSection");

    if (btnCreateQuiz) {
        if (isGuru()) {
            btnCreateQuiz.style.display = "inline-flex";
            btnCreateQuiz.onclick = async function() {
                resetFormQuiz();
                await loadKelasUntukQuiz();
                toggleModal("modalQuiz");
            };
        } else {
            btnCreateQuiz.style.display = "none";
        }
    }

    if (scoreSection) {
        scoreSection.classList.remove("hidden");
    }

    await muatDaftarQuiz();
};

window.resetFormQuiz = function() {
    draftSoalQuiz = [];

    const title = document.getElementById("quizTitle");
    const kelasSelect = document.getElementById("quizKelasSelect");
    const duration = document.getElementById("quizDuration");

    if (title) title.value = "";
    if (kelasSelect) kelasSelect.value = "";
    if (duration) duration.value = "";

    resetFormSoalAktif();
    renderPreviewSoal();
};

window.resetFormSoalAktif = function() {
    const nomor = draftSoalQuiz.length + 1;
    const formTitle = document.getElementById("formSoalTitle");

    if (formTitle) formTitle.textContent = `Soal ${nomor}`;

    const soalText = document.getElementById("soalText");
    const optA = document.getElementById("optA");
    const optB = document.getElementById("optB");
    const optC = document.getElementById("optC");
    const optD = document.getElementById("optD");
    const kunci = document.getElementById("kunciJawaban");

    if (soalText) soalText.value = "";
    if (optA) optA.value = "";
    if (optB) optB.value = "";
    if (optC) optC.value = "";
    if (optD) optD.value = "";
    if (kunci) kunci.value = "a";
};

window.simpanSoalSementara = function() {
    const soal = document.getElementById("soalText")?.value.trim();
    const a = document.getElementById("optA")?.value.trim();
    const b = document.getElementById("optB")?.value.trim();
    const c = document.getElementById("optC")?.value.trim();
    const d = document.getElementById("optD")?.value.trim();
    const kunci = document.getElementById("kunciJawaban")?.value;

    if (!soal || !a || !b || !c || !d || !kunci) {
        alert("Lengkapi semua field soal terlebih dahulu.");
        return;
    }

    draftSoalQuiz.push({ soal, a, b, c, d, kunci });
    renderPreviewSoal();
    resetFormSoalAktif();
};

window.renderPreviewSoal = function() {
    const preview = document.getElementById("previewSoalList");
    if (!preview) return;

    preview.innerHTML = "";

    if (!draftSoalQuiz.length) {
        preview.innerHTML = `<p>Belum ada soal disimpan.</p>`;
        return;
    }

    draftSoalQuiz.forEach((item, index) => {
        preview.innerHTML += `
            <div style="border:1px solid #ddd; border-radius:12px; padding:12px; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                    <strong>Soal ${index + 1}</strong>
                    <button type="button" class="ghost-btn" onclick="hapusSoalDraft(${index})">Hapus</button>
                </div>
                <p style="margin:8px 0 6px 0;">${escapeHtml(item.soal)}</p>
                <small>Kunci: ${item.kunci.toUpperCase()}</small>
            </div>
        `;
    });
};

window.hapusSoalDraft = function(index) {
    draftSoalQuiz.splice(index, 1);
    renderPreviewSoal();
    resetFormSoalAktif();
};

window.simpanQuizBaru = async function() {
    const user = getCurrentUser();

    if (!isGuru()) {
        alert("Hanya guru yang dapat membuat quiz.");
        return;
    }

    const judul = document.getElementById('quizTitle')?.value.trim();
    const kelasId = document.getElementById('quizKelasSelect')?.value;
    const durasi = parseInt(document.getElementById('quizDuration')?.value) || 10;

    if (!judul || !kelasId) {
        alert("Judul quiz dan kelas wajib dipilih.");
        return;
    }

    if (!draftSoalQuiz.length) {
        alert("Tambahkan minimal 1 soal dengan tombol 'Simpan Soal'.");
        return;
    }

    try {
        const kelasDoc = await db.collection("kelas").doc(kelasId).get();
        if (!kelasDoc.exists) {
            alert("Kelas tidak ditemukan.");
            return;
        }

        const kelasData = kelasDoc.data();

        if (kelasData.guru_email !== user.email) {
            alert("Anda hanya dapat membuat quiz untuk kelas milik Anda.");
            return;
        }

        await db.collection("quizzes").add({
            judul_quiz: judul,
            kelas_id: kelasId,
            kelas_nama: kelasData.nama_kelas || "",
            kode_kelas: kelasData.kode_kelas || "",
            durasi: durasi,
            pembuat: user.email,
            pembuat_nama: getNamaUser(user),
            pertanyaan: draftSoalQuiz,
            hasil_siswa: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Quiz berhasil dipublikasikan.");
        toggleModal("modalQuiz");
        resetFormQuiz();
        muatDaftarQuiz();
    } catch (e) {
        console.error("Gagal membuat quiz:", e);
        alert("Gagal membuat quiz.");
    }
};

window.muatDaftarQuiz = async function() {
    const grid = document.getElementById("quizGrid");
    if (!grid) return;

    const user = getCurrentUser();

    try {
        let quizList = [];

        if (isGuru()) {
            const snapshot = await db.collection("quizzes")
                .where("pembuat", "==", user.email)
                .get();

            snapshot.forEach((doc) => {
                quizList.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
        } else {
            const joinedClassIds = await getKelasYangDiikutiSiswa();
            const snapshot = await db.collection("quizzes").get();

            snapshot.forEach((doc) => {
                const data = doc.data();
                if (joinedClassIds.includes(data.kelas_id)) {
                    quizList.push({
                        id: doc.id,
                        ...data
                    });
                }
            });
        }

        quizList.sort((a, b) => {
            const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return bTime - aTime;
        });

        grid.innerHTML = "";

        if (!quizList.length) {
            grid.innerHTML = `
                <article class="card-subject">
                    <div class="subject-tag">BELUM ADA</div>
                    <h3>Belum ada quiz</h3>
                    <p>${isGuru() ? "Anda belum membuat quiz." : "Belum ada quiz untuk kelas yang Anda ikuti."}</p>
                </article>
            `;
            tampilkanNilaiQuiz([]);
            return;
        }

        quizList.forEach((data) => {
            const isOwner = isGuru() && data.pembuat === user.email;
            const jumlahSoal = Array.isArray(data.pertanyaan) ? data.pertanyaan.length : 0;
            const hasilSiswa = Array.isArray(data.hasil_siswa) ? data.hasil_siswa : [];
            const sudahMengerjakan = hasilSiswa.some(item => item.email === user.email);

            grid.innerHTML += `
                <article class="card-subject">
                    <div class="subject-tag">QUIZ</div>
                    <h3>${escapeHtml(data.judul_quiz || "-")}</h3>
                    <p><strong>Kelas:</strong> ${escapeHtml(data.kelas_nama || "-")}</p>
                    <p><strong>Durasi:</strong> ${data.durasi || 10} menit</p>
                    <p><strong>Jumlah soal:</strong> ${jumlahSoal}</p>
                    <div class="card-footer-row" style="margin-top:16px; display:flex; gap:10px; flex-wrap:wrap;">
                        ${isSiswa() && !sudahMengerjakan ? `<button class="btn-buka" onclick="mulaiQuiz('${data.id}')">Mulai</button>` : ""}
                        ${isSiswa() && sudahMengerjakan ? `<button class="ghost-btn" onclick="lihatNilaiQuiz('${data.id}')">Lihat Nilai</button>` : ""}
                        ${isOwner ? `<button class="ghost-btn" onclick="lihatNilaiQuiz('${data.id}')">Nilai Siswa</button>` : ""}
                        ${isOwner ? `<button class="ghost-btn" onclick="hapusQuiz('${data.id}')">Hapus</button>` : ""}
                    </div>
                </article>
            `;
        });

        tampilkanNilaiQuiz(quizList);
    } catch (e) {
        console.error("Gagal memuat quiz:", e);
        grid.innerHTML = `
            <article class="card-subject">
                <div class="subject-tag">ERROR</div>
                <h3>Gagal memuat quiz</h3>
                <p>Periksa koneksi atau konfigurasi Firebase.</p>
            </article>
        `;
    }
};

window.hapusQuiz = async function(id) {
    if (!isGuru()) {
        alert("Hanya guru yang dapat menghapus quiz.");
        return;
    }

    const konfirmasi = confirm("Yakin ingin menghapus quiz ini?");
    if (!konfirmasi) return;

    try {
        await db.collection("quizzes").doc(id).delete();
        alert("Quiz berhasil dihapus.");
        muatDaftarQuiz();
    } catch (e) {
        console.error("Gagal menghapus quiz:", e);
        alert("Gagal menghapus quiz.");
    }
};

window.mulaiQuiz = async function(id) {
    const workArea = document.getElementById("quizWorkArea");
    const soalKonten = document.getElementById("soalKonten");
    const quizActiveTitle = document.getElementById("quizActiveTitle");
    const timerDisplay = document.getElementById("timerDisplay");
    const user = getCurrentUser();

    try {
        const doc = await db.collection("quizzes").doc(id).get();
        if (!doc.exists) {
            alert("Quiz tidak ditemukan.");
            return;
        }

        const data = doc.data();
        const pertanyaan = Array.isArray(data.pertanyaan) ? data.pertanyaan : [];
        const hasil = Array.isArray(data.hasil_siswa) ? data.hasil_siswa : [];
        const sudahAda = hasil.some((item) => item.email === user.email);

        if (sudahAda) {
            alert("Quiz ini hanya bisa dikerjakan sekali.");
            lihatNilaiQuiz(id);
            return;
        }

        if (!pertanyaan.length) {
            alert("Soal quiz tidak tersedia.");
            return;
        }

        workArea.classList.remove("hidden");
        quizActiveTitle.textContent = data.judul_quiz || "Quiz";

        soalKonten.innerHTML = pertanyaan.map((soal, index) => `
            <div style="margin-bottom:24px; padding-bottom:16px; border-bottom:1px solid #eee;">
                <p><strong>${index + 1}. ${escapeHtml(soal.soal)}</strong></p>
                <label><input type="radio" name="jawaban_${index}" value="a"> ${escapeHtml(soal.a)}</label><br><br>
                <label><input type="radio" name="jawaban_${index}" value="b"> ${escapeHtml(soal.b)}</label><br><br>
                <label><input type="radio" name="jawaban_${index}" value="c"> ${escapeHtml(soal.c)}</label><br><br>
                <label><input type="radio" name="jawaban_${index}" value="d"> ${escapeHtml(soal.d)}</label>
            </div>
        `).join("") + `
            <button class="btn-buka" onclick="submitQuiz('${id}')">Kirim Jawaban</button>
        `;

        let sisaDetik = (data.durasi || 10) * 60;

        clearInterval(quizTimer);
        quizTimer = setInterval(() => {
            const menit = String(Math.floor(sisaDetik / 60)).padStart(2, '0');
            const detik = String(sisaDetik % 60).padStart(2, '0');
            timerDisplay.textContent = `Sisa Waktu: ${menit}:${detik}`;

            if (sisaDetik <= 0) {
                clearInterval(quizTimer);
                submitQuiz(id, true);
                return;
            }

            sisaDetik--;
        }, 1000);
    } catch (e) {
        console.error("Gagal memulai quiz:", e);
        alert("Gagal memulai quiz.");
    }
};

window.submitQuiz = async function(id, autoSubmit = false) {
    const user = getCurrentUser();

    try {
        const doc = await db.collection("quizzes").doc(id).get();
        if (!doc.exists) return;

        const data = doc.data();
        const pertanyaan = Array.isArray(data.pertanyaan) ? data.pertanyaan : [];
        const hasil = Array.isArray(data.hasil_siswa) ? data.hasil_siswa : [];

        const sudahAda = hasil.some((item) => item.email === user.email);
        if (sudahAda) {
            alert("Anda sudah mengerjakan quiz ini.");
            return;
        }

        let benar = 0;
        const jawabanSiswa = [];

        for (let i = 0; i < pertanyaan.length; i++) {
            const jawaban = document.querySelector(`input[name="jawaban_${i}"]:checked`)?.value || null;

            jawabanSiswa.push({
                nomor: i + 1,
                jawaban: jawaban
            });

            if (jawaban && jawaban === pertanyaan[i].kunci) {
                benar++;
            }
        }

        const skor = pertanyaan.length ? Math.round((benar / pertanyaan.length) * 100) : 0;

        hasil.push({
            nama: getNamaUser(user),
            email: user.email,
            jawaban: jawabanSiswa,
            benar: benar,
            total_soal: pertanyaan.length,
            skor: skor,
            submittedAt: new Date().toISOString()
        });

        await db.collection("quizzes").doc(id).update({
            hasil_siswa: hasil
        });

        clearInterval(quizTimer);
        alert(autoSubmit ? `Waktu habis. Nilai Anda: ${skor}` : `Quiz selesai. Nilai Anda: ${skor}`);
        document.getElementById("quizWorkArea")?.classList.add("hidden");
        muatDaftarQuiz();
    } catch (e) {
        console.error("Gagal submit quiz:", e);
        alert("Gagal mengirim jawaban.");
    }
};

window.tampilkanNilaiQuiz = function() {
    const sectionTitle = document.getElementById("nilaiSectionTitle");
    const sectionDesc = document.getElementById("nilaiSectionDesc");
    const list = document.getElementById("nilaiQuizList");

    if (!list) return;

    if (sectionTitle) {
        sectionTitle.textContent = isGuru() ? "Nilai Siswa" : "Nilai Quiz Saya";
    }

    if (sectionDesc) {
        sectionDesc.textContent = isGuru()
            ? "Pilih tombol 'Nilai Siswa' pada quiz untuk melihat hasil siswa."
            : "Pilih tombol 'Lihat Nilai' pada quiz yang sudah Anda kerjakan.";
    }

    list.innerHTML = `
        <article class="card-subject">
            <div class="subject-tag">INFO</div>
            <h3>${isGuru() ? "Belum memilih quiz" : "Belum ada nilai dipilih"}</h3>
            <p>${isGuru() ? "Klik tombol 'Nilai Siswa' pada salah satu quiz." : "Setelah mengerjakan quiz, klik 'Lihat Nilai'."}</p>
        </article>
    `;
};

window.lihatNilaiQuiz = async function(id) {
    const list = document.getElementById("nilaiQuizList");
    const sectionTitle = document.getElementById("nilaiSectionTitle");
    const sectionDesc = document.getElementById("nilaiSectionDesc");
    const user = getCurrentUser();

    if (!list) return;

    try {
        const doc = await db.collection("quizzes").doc(id).get();
        if (!doc.exists) {
            list.innerHTML = `<p>Quiz tidak ditemukan.</p>`;
            return;
        }

        const data = doc.data();
        const hasil = Array.isArray(data.hasil_siswa) ? data.hasil_siswa : [];

        if (sectionTitle) {
            sectionTitle.textContent = isGuru()
                ? `Nilai Siswa - ${data.judul_quiz || "Quiz"}`
                : `Nilai Saya - ${data.judul_quiz || "Quiz"}`;
        }

        if (sectionDesc) {
            sectionDesc.textContent = isGuru()
                ? "Berikut hasil siswa yang sudah mengerjakan quiz ini."
                : "Berikut hasil quiz yang sudah Anda kerjakan.";
        }

        list.innerHTML = "";

        if (isGuru()) {
            if (!hasil.length) {
                list.innerHTML = `
                    <article class="card-subject">
                        <div class="subject-tag">BELUM ADA</div>
                        <h3>Belum ada siswa mengerjakan</h3>
                        <p>Hasil quiz siswa akan tampil di sini.</p>
                    </article>
                `;
                return;
            }

            hasil.forEach((item) => {
                list.innerHTML += `
                    <article class="card-subject">
                        <div class="subject-tag">NILAI SISWA</div>
                        <h3>${escapeHtml(item.nama || "-")}</h3>
                        <p><strong>Email:</strong> ${escapeHtml(item.email || "-")}</p>
                        <p><strong>Skor:</strong> ${item.skor ?? 0}</p>
                        <p><strong>Benar:</strong> ${item.benar ?? 0} / ${item.total_soal ?? 0}</p>
                        <p><strong>Dikirim:</strong> ${formatTanggal(item.submittedAt)}</p>
                    </article>
                `;
            });
        } else {
            const nilaiSaya = hasil.find((item) => item.email === user.email);

            if (!nilaiSaya) {
                list.innerHTML = `
                    <article class="card-subject">
                        <div class="subject-tag">BELUM ADA</div>
                        <h3>Anda belum memiliki nilai</h3>
                        <p>Kerjakan quiz terlebih dahulu.</p>
                    </article>
                `;
                return;
            }

            list.innerHTML = `
                <article class="card-subject">
                    <div class="subject-tag">NILAI SAYA</div>
                    <h3>${escapeHtml(data.judul_quiz || "-")}</h3>
                    <p><strong>Skor:</strong> ${nilaiSaya.skor ?? 0}</p>
                    <p><strong>Benar:</strong> ${nilaiSaya.benar ?? 0} / ${nilaiSaya.total_soal ?? 0}</p>
                    <p><strong>Status:</strong> Selesai</p>
                </article>
            `;
        }
    } catch (e) {
        console.error("Gagal memuat nilai quiz:", e);
        list.innerHTML = `<p>Gagal memuat nilai quiz.</p>`;
    }
};

/* ==========================================================
   9. PROFILE
   ========================================================== */
window.initProfilePage = function() {
    const user = getCurrentUser();
    if (!user.email) {
        window.location.href = "index.html";
        return;
    }

    const name = getNamaUser(user);
    document.getElementById("profileName") && (document.getElementById("profileName").textContent = name);
    document.getElementById("detailName") && (document.getElementById("detailName").textContent = name);
    document.getElementById("profileRole") && (document.getElementById("profileRole").textContent = user.role.toUpperCase());
    document.getElementById("detailEmail") && (document.getElementById("detailEmail").textContent = user.email);
    document.getElementById("detailRole") && (document.getElementById("detailRole").textContent = user.role);
    document.getElementById("avatarBox") && (document.getElementById("avatarBox").textContent = name.substring(0, 2).toUpperCase());
};

/* ==========================================================
   10. GLOBAL INIT
   ========================================================== */
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    const halamanButuhLogin = [
        'dashboard.html',
        'kelas.html',
        'materi.html',
        'profil.html',
        'quiz.html'
    ];

    const perluLogin = halamanButuhLogin.some(page => path.includes(page));
    if (perluLogin && !getCurrentUser().email) {
        window.location.href = 'index.html';
        return;
    }

    if (path.includes('dashboard.html')) initDashboard();

    if (path.includes('kelas.html')) {
        if (getUrlParam("tab") === "detail" && getUrlParam("kelas_id")) {
            initDetailKelasPage();
        } else {
            initKelasPage();
        }
    }

    if (path.includes('materi.html')) initMateriPage();
    if (path.includes('quiz.html')) initQuizPage();
    if (path.includes('profil.html')) initProfilePage();
});

/* ==========================================================
   11. DASHBOARD
   ========================================================== */
window.initDashboard = async function() {
    const user = getCurrentUser();
    if (!user.email) {
        window.location.href = "index.html";
        return;
    }

    await isiHeaderDashboard(user);
    await isiStatDashboard(user);
    await isiQuickMenu(user);
    await isiMateriDashboard(user);
    await isiQuizDashboard(user);
    await isiKelasDashboard(user);
    aturAksiDashboard(user);
};

window.isiHeaderDashboard = async function(user) {
    const welcomeLabel = document.getElementById("welcomeLabel");
    const heroBadge = document.getElementById("heroBadge");
    const heroTitle = document.getElementById("heroTitle");
    const heroDesc = document.getElementById("heroDesc");

    const nama = getNamaUser(user);

    if (welcomeLabel) welcomeLabel.textContent = user.role === "guru" ? `Dashboard guru • ${nama}` : `Dashboard siswa • ${nama}`;
    if (heroBadge) heroBadge.textContent = user.role === "guru" ? "EduSmart • Panel Pengelolaan Kelas" : "EduSmart • Panel Aktivitas Belajar";
    if (heroTitle) heroTitle.textContent = user.role === "guru"
        ? `Selamat datang, ${nama}. Kelola kelas, materi, dan quiz dengan mudah.`
        : `Selamat datang, ${nama}. Pantau kelas, materi, dan quiz Anda di satu tempat.`;
    if (heroDesc) heroDesc.textContent = user.role === "guru"
        ? "Semua aktivitas mengajar tersusun rapi: unggah materi, buat quiz, dan atur kelas aktif."
        : "Akses materi, ikuti quiz, dan lihat perkembangan kelas Anda dengan tampilan yang lebih rapi.";
};

window.isiStatDashboard = async function(user) {
    const statOne = document.getElementById("statOne");
    const statTwo = document.getElementById("statTwo");
    const statThree = document.getElementById("statThree");

    try {
        if (isGuru()) {
            const materiSnap = await db.collection("materi")
                .where("email_pengunggah", "==", user.email)
                .get();

            const quizSnap = await db.collection("quizzes")
                .where("pembuat", "==", user.email)
                .get();

            const kelasSnap = await db.collection("kelas")
                .where("guru_email", "==", user.email)
                .get();

            if (statOne) statOne.textContent = `${materiSnap.size} Materi dikelola`;
            if (statTwo) statTwo.textContent = `${quizSnap.size} Quiz dipublikasikan`;
            if (statThree) statThree.textContent = `${kelasSnap.size} Kelas aktif`;
        } else {
            const kelasSnap = await db.collection("kelas").get();
            const joinedClassIds = [];

            kelasSnap.forEach(doc => {
                const data = doc.data();
                const siswa = data.siswa_terdaftar || [];
                const ikut = siswa.some(item => item.email === user.email);
                if (ikut) {
                    joinedClassIds.push(doc.id);
                }
            });

            const materiSnap = await db.collection("materi").get();
            let totalMateri = 0;

            materiSnap.forEach(doc => {
                const data = doc.data();
                if (joinedClassIds.includes(data.kelas_id)) {
                    totalMateri++;
                }
            });

            const quizSnap = await db.collection("quizzes").get();
            let totalQuiz = 0;

            quizSnap.forEach(doc => {
                const data = doc.data();
                if (joinedClassIds.includes(data.kelas_id)) {
                    totalQuiz++;
                }
            });

            if (statOne) statOne.textContent = `${totalMateri} Materi tersedia`;
            if (statTwo) statTwo.textContent = `${totalQuiz} Quiz tersedia`;
            if (statThree) statThree.textContent = `${joinedClassIds.length} Kelas diikuti`;
        }
    } catch (e) {
        console.error("Gagal memuat statistik dashboard:", e);
        if (statOne) statOne.textContent = "0 Materi";
        if (statTwo) statTwo.textContent = "0 Quiz";
        if (statThree) statThree.textContent = "0 Kelas";
    }
};

window.isiQuickMenu = async function() {
    const quickGrid = document.getElementById("quickGrid");
    if (!quickGrid) return;

    quickGrid.innerHTML = `
        <article class="card-subject">
            <div class="subject-tag">MATERI</div>
            <h3>Materi Pembelajaran</h3>
            <p>${isGuru() ? "Kelola materi kelas dan unggah konten baru." : "Akses materi terbaru dari guru."}</p>
            <div class="card-footer-row" style="margin-top:16px;">
                <a href="materi.html" class="btn-buka">Buka Materi</a>
            </div>
        </article>

        <article class="card-subject">
            <div class="subject-tag">QUIZ</div>
            <h3>Quiz & Evaluasi</h3>
            <p>${isGuru() ? "Publikasikan quiz untuk kelas Anda." : "Kerjakan quiz aktif yang tersedia."}</p>
            <div class="card-footer-row" style="margin-top:16px;">
                <a href="quiz.html" class="btn-buka">Buka Quiz</a>
            </div>
        </article>

        <article class="card-subject">
            <div class="subject-tag">KELAS</div>
            <h3>Ruang Kelas</h3>
            <p>${isGuru() ? "Lihat kelas aktif dan atur pengumuman." : "Pantau kelas yang Anda ikuti."}</p>
            <div class="card-footer-row" style="margin-top:16px;">
                <a href="kelas.html" class="btn-buka">Buka Kelas</a>
            </div>
        </article>
    `;
};

window.isiMateriDashboard = async function(user) {
    const materiGrid = document.getElementById("materiGrid");
    if (!materiGrid) return;

    try {
        let materiList = [];

        if (isGuru()) {
            const snapshot = await db.collection("materi")
                .where("email_pengunggah", "==", user.email)
                .get();

            snapshot.forEach(doc => {
                materiList.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
        } else {
            // siswa: hanya ambil materi dari kelas yang diikuti
            const kelasSnap = await db.collection("kelas").get();
            const joinedClassIds = [];

            kelasSnap.forEach(doc => {
                const data = doc.data();
                const siswa = data.siswa_terdaftar || [];
                const ikut = siswa.some(item => item.email === user.email);
                if (ikut) {
                    joinedClassIds.push(doc.id);
                }
            });

            // kalau belum ikut kelas, jangan tampilkan materi
            if (!joinedClassIds.length) {
                materiGrid.innerHTML = `
                    <article class="card-subject">
                        <div class="subject-tag">BELUM ADA</div>
                        <h3>Belum ada materi</h3>
                        <p>Anda belum tergabung ke kelas mana pun.</p>
                    </article>
                `;
                return;
            }

            const materiSnap = await db.collection("materi").get();
            materiSnap.forEach(doc => {
                const data = doc.data();
                if (joinedClassIds.includes(data.kelas_id)) {
                    materiList.push({
                        id: doc.id,
                        ...data
                    });
                }
            });
        }

        materiList.sort((a, b) => {
            const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return bTime - aTime;
        });

        const tampil = materiList.slice(0, 3);
        materiGrid.innerHTML = "";

        if (!tampil.length) {
            materiGrid.innerHTML = `
                <article class="card-subject">
                    <div class="subject-tag">BELUM ADA</div>
                    <h3>Belum ada materi</h3>
                    <p>${isGuru() ? "Anda belum mengunggah materi." : "Belum ada materi untuk kelas yang Anda ikuti."}</p>
                </article>
            `;
            return;
        }

        tampil.forEach((data) => {
            materiGrid.innerHTML += `
                <article class="card-subject">
                    <div class="subject-tag">${escapeHtml(data.kategori || "Materi")}</div>
                    <h3>${escapeHtml(data.judul || "-")}</h3>
                    <p>${escapeHtml(data.deskripsi || "-")}</p>
                    <div class="card-footer-row" style="margin-top:16px;">
                        <button type="button" class="btn-buka" onclick="bukaMateriById('${data.id}')">Buka</button>
                    </div>
                </article>
            `;
        });
    } catch (e) {
        console.error("Gagal memuat materi dashboard:", e);
        materiGrid.innerHTML = `
            <article class="card-subject">
                <div class="subject-tag">ERROR</div>
                <h3>Gagal memuat materi</h3>
                <p>Periksa koneksi atau data Firestore.</p>
            </article>
        `;
    }
};

window.isiQuizDashboard = async function(user) {
    const quizSection = document.getElementById("quiz");
    const quizGrid = document.getElementById("quizGrid");
    if (!quizSection || !quizGrid) return;

    quizSection.classList.remove("hidden");

    try {
        let quizList = [];
        let snapshot;

        if (isGuru()) {
            // Guru: tetap lihat quiz miliknya sendiri
            snapshot = await db.collection("quizzes")
                .where("pembuat", "==", user.email)
                .get();

            snapshot.forEach(doc => {
                quizList.push({ id: doc.id, ...doc.data() });
            });

        } else {
            // 🔥 Siswa: ambil kelas yang diikuti
            const joinedClassIds = await getKelasYangDiikutiSiswa();

            if (!joinedClassIds.length) {
                quizGrid.innerHTML = `<p>Anda belum mengikuti kelas apapun.</p>`;
                return;
            }

            snapshot = await db.collection("quizzes").get();

            snapshot.forEach(doc => {
                const data = doc.data();

                // ✅ FILTER DI SINI
                if (joinedClassIds.includes(data.kelas_id)) {
                    quizList.push({ id: doc.id, ...data });
                }
            });
        }

        // sorting
        quizList.sort((a, b) => {
            const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return bTime - aTime;
        });

        const tampil = quizList.slice(0, 3);
        quizGrid.innerHTML = "";

        if (!tampil.length) {
            quizGrid.innerHTML = `<p>Belum ada quiz tersedia.</p>`;
            return;
        }

        tampil.forEach((data) => {
            quizGrid.innerHTML += `
                <article class="card-subject">
                    <div class="subject-tag">QUIZ</div>
                    <h3>${escapeHtml(data.judul_quiz || "-")}</h3>
                    <p><strong>Kelas:</strong> ${escapeHtml(data.kelas_nama || data.kode_kelas || "-")}</p>
                    <p><strong>Durasi:</strong> ${data.durasi || 10} menit</p>
                    <div class="card-footer-row" style="margin-top:16px;">
                        <a href="quiz.html" class="btn-buka">${isGuru() ? "Kelola" : "Kerjakan"}</a>
                    </div>
                </article>
            `;
        });

    } catch (e) {
        console.error("Gagal memuat quiz dashboard:", e);
        quizGrid.innerHTML = `<p>Gagal memuat quiz.</p>`;
    }
};

window.isiKelasDashboard = async function(user) {
    const kelasSection = document.getElementById("kelas");
    const kelasGrid = document.getElementById("kelasGrid");
    if (!kelasSection || !kelasGrid) return;

    kelasSection.classList.remove("hidden");

    try {
        const snapshot = await db.collection("kelas").get();
        const kelasList = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const siswa = data.siswa_terdaftar || [];
            const ikut = siswa.some(item => item.email === user.email);
            const milikGuru = data.guru_email === user.email;

            if ((isGuru() && milikGuru) || (isSiswa() && ikut)) {
                kelasList.push({ id: doc.id, ...data });
            }
        });

        kelasList.sort((a, b) => {
            const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return bTime - aTime;
        });

        const tampil = kelasList.slice(0, 3);
        kelasGrid.innerHTML = "";

        if (!tampil.length) {
            kelasGrid.innerHTML = `<p>Belum ada kelas tersedia.</p>`;
            return;
        }

        tampil.forEach((data) => {
            kelasGrid.innerHTML += `
                <article class="card-subject">
                    <div class="subject-tag">${data.status_aktif ? "KELAS AKTIF" : "KELAS NONAKTIF"}</div>
                    <h3>${escapeHtml(data.nama_kelas || "-")}</h3>
                    <p><strong>Guru:</strong> ${escapeHtml(data.guru_nama || "-")}</p>
                    <p><strong>Kode:</strong> ${escapeHtml(data.kode_kelas || "-")}</p>
                    <div class="card-footer-row" style="margin-top:16px;">
                        <a href="kelas.html" class="btn-buka">Buka Kelas</a>
                    </div>
                </article>
            `;
        });
    } catch (e) {
        console.error("Gagal memuat kelas dashboard:", e);
        kelasGrid.innerHTML = `<p>Gagal memuat kelas.</p>`;
    }
};

window.aturAksiDashboard = function() {
    const materiAction = document.getElementById("materiAction");
    if (materiAction) materiAction.classList.add("hidden");
};

window.tambahMateri = async function() {
    alert("Materi hanya dapat ditambahkan dari halaman kelas yang dibuat guru.");
};

/* ==========================================================
   12. RESET PASSWORD MANUAL
   ========================================================== */
window.resetPasswordManual = async function() {
    const email = document.getElementById("resetEmail")?.value.trim();
    const newPass = document.getElementById("resetPassword")?.value;
    const confirmPass = document.getElementById("resetConfirmPassword")?.value;
    const resetError = document.getElementById("resetErrorMsg");

    if (resetError) resetError.textContent = "";

    if (!email || !newPass || !confirmPass) {
        if (resetError) resetError.textContent = "Semua field wajib diisi.";
        return;
    }

    if (newPass !== confirmPass) {
        if (resetError) resetError.textContent = "Konfirmasi password tidak cocok.";
        return;
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!passwordRegex.test(newPass)) {
        if (resetError) resetError.textContent = "Password wajib 8+ karakter, mengandung huruf besar, angka, dan simbol.";
        return;
    }

    try {
        const snapshot = await db.collection("users")
            .where("email", "==", email)
            .get();

        if (snapshot.empty) {
            if (resetError) resetError.textContent = "Email tidak ditemukan.";
            return;
        }

        const batch = db.batch();
        snapshot.forEach((doc) => {
            batch.update(doc.ref, {
                password: newPass
            });
        });

        await batch.commit();

        alert("Password berhasil diperbarui. Silakan login.");
        if (document.getElementById("resetEmail")) document.getElementById("resetEmail").value = "";
        if (document.getElementById("resetPassword")) document.getElementById("resetPassword").value = "";
        if (document.getElementById("resetConfirmPassword")) document.getElementById("resetConfirmPassword").value = "";
        toggleModal("modalLupaSandi");
    } catch (e) {
        console.error("Gagal reset password:", e);
        if (resetError) resetError.textContent = "Gagal reset password.";
    }
};

window.lihatSiswaKelas = async function(kelasId) {
    try {
        const doc = await db.collection("kelas").doc(kelasId).get();

        if (!doc.exists) {
            alert("Kelas tidak ditemukan");
            return;
        }

        const data = doc.data();
        const siswa = Array.isArray(data.siswa_terdaftar) ? data.siswa_terdaftar : [];

        console.log("DATA SISWA:", siswa); // debug

        const container = document.getElementById("daftarSiswaKelas");

        if (!container) {
            console.error("Element daftarSiswaKelas tidak ada di HTML");
            return;
        }

        container.innerHTML = "";

        if (siswa.length === 0) {
            container.innerHTML = `<p>Belum ada siswa yang bergabung.</p>`;
            return;
        }

        siswa.forEach((s, i) => {
            container.innerHTML += `
                <div class="card-siswa">
                    <p><strong>${i + 1}. ${escapeHtml(s.nama || "-")}</strong></p>
                    <p>${escapeHtml(s.email || "-")}</p>
                </div>
            `;
        });

        // tampilkan modal / section
        toggleModal("modalSiswaKelas");

    } catch (e) {
        console.error("Gagal ambil siswa:", e);
        alert("Gagal memuat data siswa");
    }
};