/* ==========================================================
   1. GLOBAL VARIABLES & CONFIG
   ========================================================== */
let selectedRole = 'siswa';
let registerRole = 'siswa';
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
        return "-";
    }
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

window.logout = function() {
    localStorage.removeItem("edusmartUser");
    window.location.href = "index.html";
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
        b.classList.toggle('active', b.getAttribute('onclick').includes(role));
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
        btn.textContent = '🔒';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
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

    if (guruControls) {
        guruControls.style.display = isGuru() ? "flex" : "none";
    }

    if (siswaControls) {
        siswaControls.style.display = isSiswa() ? "flex" : "none";
    }

    await muatDaftarKelas();
};

window.simpanKelasBaru = async function() {
    if (!isGuru()) {
        alert("Hanya guru yang dapat membuat kelas.");
        return;
    }

    const user = getCurrentUser();
    const nama = document.getElementById('inputNamaKelas')?.value.trim();
    const aktif = document.getElementById('inputStatusKelas')?.checked ?? true;
    const kode = Math.random().toString(36).substring(2, 8).toUpperCase();

    if (!nama) {
        return alert("Nama kelas wajib diisi.");
    }

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
        document.getElementById('inputNamaKelas').value = '';
        toggleModal('modalTambahKelas');
        muatDaftarKelas();
    } catch (e) {
        console.error(e);
        alert("Gagal membuat kelas.");
    }
};

window.gabungKeKelas = async function() {
    if (!isSiswa()) {
        alert("Hanya siswa yang dapat bergabung ke kelas.");
        return;
    }

    const user = getCurrentUser();
    const kodeInput = document.getElementById('inputKodeGabung')?.value.trim().toUpperCase();

    if (!kodeInput) {
        return alert("Masukkan kode kelas.");
    }

    try {
        const snapshot = await db.collection("kelas")
            .where("kode_kelas", "==", kodeInput)
            .get();

        if (snapshot.empty) {
            return alert("Kode kelas tidak ditemukan.");
        }

        const doc = snapshot.docs[0];
        const data = doc.data();
        const siswa = data.siswa_terdaftar || [];

        const sudahGabung = siswa.some(item => item.email === user.email);
        if (sudahGabung) {
            return alert("Anda sudah tergabung di kelas ini.");
        }

        siswa.push({
            nama: getNamaUser(user),
            email: user.email
        });

        await db.collection("kelas").doc(doc.id).update({
            siswa_terdaftar: siswa
        });

        alert("Berhasil bergabung ke kelas.");
        document.getElementById('inputKodeGabung').value = '';
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
    if (!isGuru()) {
        alert("Hanya guru yang dapat menghapus kelas.");
        return;
    }

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
   6. DETAIL KELAS: PENGUMUMAN + JADWAL
   ========================================================== */
window.initDetailKelasPage = async function() {
    const user = getCurrentUser();
    if (!user.email) {
        window.location.href = "index.html";
        return;
    }

    const kelasId = getUrlParam("kelas_id");
    if (!kelasId) {
        console.error("kelas_id tidak ditemukan di URL");
        return;
    }

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
        if (!doc.exists) {
            console.error("Dokumen kelas tidak ditemukan:", kelasId);
            return;
        }

        const data = doc.data();
        const title = document.getElementById("detailNamaKelas");
        const desc = document.getElementById("detailInfoKelas");

        if (title) title.textContent = data.nama_kelas || "Detail Kelas";
        if (desc) {
            desc.textContent = `Kode: ${data.kode_kelas} • Guru: ${data.guru_nama || '-'} • Status: ${data.status_aktif ? 'Aktif' : 'Nonaktif'}`;
        }
    } catch (e) {
        console.error("Gagal memuat info kelas:", e);
    }
};

window.simpanPengumumanBaru = async function() {
    if (!isGuru()) {
        alert("Hanya guru yang dapat membuat pengumuman.");
        return;
    }

    const user = getCurrentUser();
    const kelasId = getUrlParam("kelas_id");
    const judul = document.getElementById("inputJudulPengumuman")?.value.trim();
    const isi = document.getElementById("inputIsiPengumuman")?.value.trim();

    if (!kelasId) {
        alert("kelas_id tidak ditemukan.");
        return;
    }

    if (!judul || !isi) {
        alert("Judul dan isi pengumuman wajib diisi.");
        return;
    }

    try {
        await db.collection("pengumuman").add({
            kelas_id: kelasId,
            judul: judul,
            isi: isi,
            dibuat_oleh_email: user.email,
            dibuat_oleh_nama: getNamaUser(user),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Pengumuman berhasil dibuat.");
        document.getElementById("inputJudulPengumuman").value = "";
        document.getElementById("inputIsiPengumuman").value = "";
        toggleModal("modalTambahPengumuman");
        await muatPengumuman(kelasId);
    } catch (e) {
        console.error("Gagal membuat pengumuman:", e);
        alert("Gagal membuat pengumuman.");
    }
};

window.simpanJadwalBaru = async function() {
    if (!isGuru()) {
        alert("Hanya guru yang dapat membuat jadwal.");
        return;
    }

    const user = getCurrentUser();
    const kelasId = getUrlParam("kelas_id");
    const hari = document.getElementById("inputHariJadwal")?.value.trim();
    const jam = document.getElementById("inputJamJadwal")?.value.trim();
    const kegiatan = document.getElementById("inputKegiatanJadwal")?.value.trim();

    if (!kelasId) {
        alert("kelas_id tidak ditemukan.");
        return;
    }

    if (!hari || !jam || !kegiatan) {
        alert("Hari, jam, dan kegiatan wajib diisi.");
        return;
    }

    try {
        await db.collection("jadwal").add({
            kelas_id: kelasId,
            hari: hari,
            jam: jam,
            kegiatan: kegiatan,
            dibuat_oleh_email: user.email,
            dibuat_oleh_nama: getNamaUser(user),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Jadwal berhasil dibuat.");
        document.getElementById("inputHariJadwal").value = "";
        document.getElementById("inputJamJadwal").value = "";
        document.getElementById("inputKegiatanJadwal").value = "";
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
        const snapshot = await db.collection("pengumuman")
            .where("kelas_id", "==", kelasId)
            .get();

        const dataList = [];
        snapshot.forEach((doc) => {
            dataList.push({
                id: doc.id,
                ...doc.data()
            });
        });

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
                    ${isGuru() ? `
                        <div style="margin-top:12px;">
                            <button class="ghost-btn" onclick="hapusPengumuman('${data.id}')">Hapus</button>
                        </div>
                    ` : ''}
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
        const snapshot = await db.collection("jadwal")
            .where("kelas_id", "==", kelasId)
            .get();

        const dataList = [];
        snapshot.forEach((doc) => {
            dataList.push({
                id: doc.id,
                ...doc.data()
            });
        });

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
                    ${isGuru() ? `
                        <div style="margin-top:12px;">
                            <button class="ghost-btn" onclick="hapusJadwal('${data.id}')">Hapus</button>
                        </div>
                    ` : ''}
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
window.initMateriPage = async function() {
    const user = getCurrentUser();
    if (!user.email) {
        window.location.href = "index.html";
        return;
    }

    const kelasId = getUrlParam("kelas_id");
    const actionBtn = document.getElementById("featureAction");

    if (actionBtn) {
        if (isGuru()) {
            actionBtn.style.display = "inline-flex";
            actionBtn.onclick = function() {
                toggleModal("modalTambahMateri");
            };
        } else {
            actionBtn.style.display = "none";
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
                ? "Semua materi yang Anda kelola akan tampil di sini."
                : "Semua materi pembelajaran yang tersedia akan tampil di sini.";
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
        let snapshot;

        // MODE 1: materi berdasarkan kelas
        if (kelasId) {
            snapshot = await db.collection("materi")
                .where("kelas_id", "==", kelasId)
                .get();
        } 
        // MODE 2: materi umum dari menu navbar
        else {
            if (isGuru()) {
                snapshot = await db.collection("materi")
                    .where("email_pengunggah", "==", user.email)
                    .get();
            } else {
                snapshot = await db.collection("materi").get();
            }
        }

        const materiList = [];
        snapshot.forEach((doc) => {
            materiList.push({
                id: doc.id,
                ...doc.data()
            });
        });

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
                    <p>${kelasId 
                        ? "Belum ada materi untuk kelas ini." 
                        : "Belum ada materi yang tersedia."}</p>
                </article>
            `;
            return;
        }

        materiList.forEach((data) => {
            const isOwner = isGuru() && user.email === data.email_pengunggah;

            grid.innerHTML += `
                <article class="card-subject">
                    <div class="subject-tag">${escapeHtml(data.kategori || "Materi")}</div>
                    <h3>${escapeHtml(data.judul || "-")}</h3>
                    <p>${escapeHtml(data.deskripsi || "-")}</p>
                    <small>
                        ${data.kelas_nama ? escapeHtml(data.kelas_nama) + " • " : ""}
                        ${formatTanggal(data.createdAt)}
                    </small>

                    <div class="card-footer-row" style="margin-top:16px; display:flex; justify-content:space-between; align-items:center;">
                        <a href="${escapeHtml(data.link_sumber || "#")}" target="_blank" class="btn-buka">Buka</a>
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
                <p>Periksa koneksi, query Firestore, atau data materi.</p>
            </article>
        `;
    }
};

window.simpanMateriBaru = async function() {
    const user = getCurrentUser();

    if (!isGuru()) {
        alert("Hanya guru yang dapat menambahkan materi.");
        return;
    }

    const kelasId = getUrlParam("kelas_id");
    const judul = document.getElementById("inputJudulMateri")?.value.trim();
    const deskripsi = document.getElementById("inputDeskripsiMateri")?.value.trim();
    const kategori = document.getElementById("inputKategoriMateri")?.value;
    const link = document.getElementById("inputLinkMateri")?.value.trim();

    if (!judul || !deskripsi || !kategori || !link) {
        alert("Semua field materi wajib diisi.");
        return;
    }

    try {
        let kelasNama = "";

        if (kelasId) {
            const kelasDoc = await db.collection("kelas").doc(kelasId).get();
            if (kelasDoc.exists) {
                kelasNama = kelasDoc.data().nama_kelas || "";
            }
        }

        await db.collection("materi").add({
            kelas_id: kelasId || null,
            kelas_nama: kelasNama || "",
            judul: judul,
            deskripsi: deskripsi,
            kategori: kategori,
            link_sumber: link,
            email_pengunggah: user.email,
            nama_pengunggah: getNamaUser(user),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Materi berhasil ditambahkan.");
        bersihkanFormMateri();
        toggleModal("modalTambahMateri");
        muatMateri(kelasId);
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
    if (!isGuru()) {
        alert("Hanya guru yang dapat menghapus materi.");
        return;
    }

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
window.initQuizPage = function() {
    const user = getCurrentUser();
    if (!user.email) {
        window.location.href = "index.html";
        return;
    }

    const btnCreateQuiz = document.getElementById("btnCreateQuiz");

    if (btnCreateQuiz) {
        if (isGuru()) {
            btnCreateQuiz.style.display = "inline-flex";
            btnCreateQuiz.onclick = function() {
                toggleModal("modalQuiz");
            };
        } else {
            btnCreateQuiz.style.display = "none";
        }
    }

    muatDaftarQuiz();
};

window.simpanQuizBaru = async function() {
    const user = getCurrentUser();

    if (!isGuru()) {
        alert("Hanya guru yang dapat membuat quiz.");
        return;
    }

    const judul = document.getElementById('quizTitle')?.value.trim();
    const kodeKelas = document.getElementById('quizClassCode')?.value.trim().toUpperCase();
    const durasi = parseInt(document.getElementById('quizDuration')?.value) || 10;
    const soal = document.getElementById('soalText')?.value.trim();
    const optA = document.getElementById('optA')?.value.trim();
    const optB = document.getElementById('optB')?.value.trim();
    const optC = document.getElementById('optC')?.value.trim();
    const kunci = document.getElementById('kunciJawaban')?.value;

    if (!judul || !kodeKelas || !soal || !optA || !optB || !optC || !kunci) {
        alert("Semua field quiz wajib diisi.");
        return;
    }

    try {
        await db.collection("quizzes").add({
            judul_quiz: judul,
            kode_kelas: kodeKelas,
            durasi: durasi,
            pembuat: user.email,
            pembuat_nama: getNamaUser(user),
            pertanyaan: [{
                soal: soal,
                a: optA,
                b: optB,
                c: optC,
                kunci: kunci
            }],
            hasil_siswa: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Quiz berhasil dipublikasikan.");

        document.getElementById('quizTitle').value = "";
        document.getElementById('quizClassCode').value = "";
        document.getElementById('quizDuration').value = "";
        document.getElementById('soalText').value = "";
        document.getElementById('optA').value = "";
        document.getElementById('optB').value = "";
        document.getElementById('optC').value = "";
        document.getElementById('kunciJawaban').value = "a";

        toggleModal("modalQuiz");
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
        const snapshot = await db.collection("quizzes").get();
        const quizList = [];

        snapshot.forEach((doc) => {
            quizList.push({
                id: doc.id,
                ...doc.data()
            });
        });

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
                    <p>Quiz yang tersedia akan tampil di sini.</p>
                </article>
            `;
            return;
        }

        quizList.forEach((data) => {
            const isOwner = isGuru() && data.pembuat === user.email;

            grid.innerHTML += `
                <article class="card-subject">
                    <div class="subject-tag">QUIZ</div>
                    <h3>${escapeHtml(data.judul_quiz || "-")}</h3>
                    <p><strong>Kode kelas:</strong> ${escapeHtml(data.kode_kelas || "-")}</p>
                    <p><strong>Durasi:</strong> ${data.durasi || 10} menit</p>
                    <div class="card-footer-row" style="margin-top:16px; display:flex; gap:10px; flex-wrap:wrap;">
                        ${isSiswa() ? `<button class="btn-buka" onclick="mulaiQuiz('${data.id}')">Mulai</button>` : ""}
                        ${isOwner ? `<button class="ghost-btn" onclick="hapusQuiz('${data.id}')">Hapus</button>` : ""}
                    </div>
                </article>
            `;
        });
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

    try {
        const doc = await db.collection("quizzes").doc(id).get();
        if (!doc.exists) {
            alert("Quiz tidak ditemukan.");
            return;
        }

        const data = doc.data();
        const soal = data.pertanyaan?.[0];

        if (!soal) {
            alert("Soal quiz tidak tersedia.");
            return;
        }

        workArea.classList.remove("hidden");
        quizActiveTitle.textContent = data.judul_quiz || "Quiz";
        soalKonten.innerHTML = `
            <p><strong>${escapeHtml(soal.soal)}</strong></p>
            <label><input type="radio" name="jawaban" value="a"> ${escapeHtml(soal.a)}</label><br><br>
            <label><input type="radio" name="jawaban" value="b"> ${escapeHtml(soal.b)}</label><br><br>
            <label><input type="radio" name="jawaban" value="c"> ${escapeHtml(soal.c)}</label><br><br>
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
                alert("Waktu habis.");
            }

            sisaDetik--;
        }, 1000);
    } catch (e) {
        console.error("Gagal memulai quiz:", e);
        alert("Gagal memulai quiz.");
    }
};

window.submitQuiz = async function(id) {
    const user = getCurrentUser();
    const jawaban = document.querySelector('input[name="jawaban"]:checked')?.value;

    if (!jawaban) {
        alert("Pilih jawaban terlebih dahulu.");
        return;
    }

    try {
        const doc = await db.collection("quizzes").doc(id).get();
        if (!doc.exists) return;

        const data = doc.data();
        const soal = data.pertanyaan?.[0];
        const hasil = data.hasil_siswa || [];

        const skor = jawaban === soal.kunci ? 100 : 0;
        const sudahAda = hasil.some((item) => item.email === user.email);

        if (sudahAda) {
            alert("Anda sudah mengerjakan quiz ini.");
            return;
        }

        hasil.push({
            nama: getNamaUser(user),
            email: user.email,
            jawaban: jawaban,
            skor: skor,
            submittedAt: new Date().toISOString()
        });

        await db.collection("quizzes").doc(id).update({
            hasil_siswa: hasil
        });

        clearInterval(quizTimer);
        alert(`Quiz selesai. Nilai Anda: ${skor}`);
        document.getElementById("quizWorkArea").classList.add("hidden");
    } catch (e) {
        console.error("Gagal submit quiz:", e);
        alert("Gagal mengirim jawaban.");
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

    if (path.includes('kelas.html')) {
        if (getUrlParam("tab") === "detail" && getUrlParam("kelas_id")) {
            initDetailKelasPage();
        } else {
            initKelasPage();
        }
    }

    if (path.includes('materi.html')) {
        initMateriPage();
    }
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

    if (welcomeLabel) {
        welcomeLabel.textContent = user.role === "guru"
            ? `Dashboard guru • ${nama}`
            : `Dashboard siswa • ${nama}`;
    }

    if (heroBadge) {
        heroBadge.textContent = user.role === "guru"
            ? "EduSmart • Panel Pengelolaan Kelas"
            : "EduSmart • Panel Aktivitas Belajar";
    }

    if (heroTitle) {
        heroTitle.textContent = user.role === "guru"
            ? `Selamat datang, ${nama}. Kelola kelas, materi, dan quiz dengan mudah.`
            : `Selamat datang, ${nama}. Pantau kelas, materi, dan quiz Anda di satu tempat.`;
    }

    if (heroDesc) {
        heroDesc.textContent = user.role === "guru"
            ? "Semua aktivitas mengajar tersusun rapi: unggah materi, buat quiz, dan atur kelas aktif."
            : "Akses materi, ikuti quiz, dan lihat perkembangan kelas Anda dengan tampilan yang lebih rapi.";
    }
};

window.isiStatDashboard = async function(user) {
    const statOne = document.getElementById("statOne");
    const statTwo = document.getElementById("statTwo");
    const statThree = document.getElementById("statThree");

    try {
        let totalMateri = 0;
        let totalQuiz = 0;
        let totalKelas = 0;

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

            totalMateri = materiSnap.size;
            totalQuiz = quizSnap.size;
            totalKelas = kelasSnap.size;

            if (statOne) statOne.textContent = `${totalMateri} Materi dikelola`;
            if (statTwo) statTwo.textContent = `${totalQuiz} Quiz dipublikasikan`;
            if (statThree) statThree.textContent = `${totalKelas} Kelas aktif`;
        } else {
            const materiSnap = await db.collection("materi").get();
            const quizSnap = await db.collection("quizzes").get();
            const kelasSnap = await db.collection("kelas").get();

            totalMateri = materiSnap.size;
            totalQuiz = quizSnap.size;

            let ikutKelas = 0;
            kelasSnap.forEach(doc => {
                const data = doc.data();
                const siswa = data.siswa_terdaftar || [];
                if (siswa.some(item => item.email === user.email)) {
                    ikutKelas++;
                }
            });

            totalKelas = ikutKelas;

            if (statOne) statOne.textContent = `${totalMateri} Materi tersedia`;
            if (statTwo) statTwo.textContent = `${totalQuiz} Quiz tersedia`;
            if (statThree) statThree.textContent = `${totalKelas} Kelas diikuti`;
        }
    } catch (e) {
        console.error("Gagal memuat statistik dashboard:", e);
        if (statOne) statOne.textContent = "0 Materi";
        if (statTwo) statTwo.textContent = "0 Quiz";
        if (statThree) statThree.textContent = "0 Kelas";
    }
};

window.isiQuickMenu = async function(user) {
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
        let snapshot;

        if (isGuru()) {
            snapshot = await db.collection("materi")
                .where("email_pengunggah", "==", user.email)
                .get();
        } else {
            snapshot = await db.collection("materi").get();
        }

        const materiList = [];
        snapshot.forEach(doc => {
            materiList.push({
                id: doc.id,
                ...doc.data()
            });
        });

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
                    <p>${isGuru() ? "Anda belum mengunggah materi." : "Belum ada materi yang tersedia."}</p>
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
                        <a href="${escapeHtml(data.link_sumber || "#")}" target="_blank" class="btn-buka">Buka</a>
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
        let snapshot;

        if (isGuru()) {
            snapshot = await db.collection("quizzes")
                .where("pembuat", "==", user.email)
                .get();
        } else {
            snapshot = await db.collection("quizzes").get();
        }

        const quizList = [];
        snapshot.forEach(doc => {
            quizList.push({
                id: doc.id,
                ...doc.data()
            });
        });

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
                kelasList.push({
                    id: doc.id,
                    ...data
                });
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

window.aturAksiDashboard = function(user) {
    const materiAction = document.getElementById("materiAction");
    if (materiAction) {
        if (isGuru()) {
            materiAction.classList.remove("hidden");
        } else {
            materiAction.classList.add("hidden");
        }
    }
};

window.tambahMateri = async function() {
    const user = getCurrentUser();

    if (!isGuru()) {
        alert("Hanya guru yang dapat menambahkan materi.");
        return;
    }

    const judul = document.getElementById("materiTitle")?.value.trim();
    const kategori = document.getElementById("materiCategory")?.value;
    const deskripsi = document.getElementById("materiDesc")?.value.trim();
    const link = document.getElementById("materiLink")?.value.trim();

    if (!judul || !kategori || !deskripsi || !link) {
        alert("Semua field materi wajib diisi.");
        return;
    }

    try {
        await db.collection("materi").add({
            judul: judul,
            kategori: kategori,
            deskripsi: deskripsi,
            link_sumber: link,
            email_pengunggah: user.email,
            nama_pengunggah: getNamaUser(user),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Materi berhasil ditambahkan.");

        document.getElementById("materiTitle").value = "";
        document.getElementById("materiCategory").value = "Matematika";
        document.getElementById("materiDesc").value = "";
        document.getElementById("materiLink").value = "";

        toggleModal("modalMateri");
        isiMateriDashboard(user);
        isiStatDashboard(user);
    } catch (e) {
        console.error("Gagal tambah materi:", e);
        alert("Gagal menambahkan materi.");
    }
};