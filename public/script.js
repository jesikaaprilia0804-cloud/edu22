/* ==========================================================
   1. GLOBAL VARIABLES & FIREBASE
   ========================================================== */
let selectedRole = 'siswa';
let registerRole = 'siswa';
let quizTimer;

const firebaseConfig = {
    apiKey: "AIzaSyC8-ugSgkGk37dNP-htNVlB8FG5NkE2p4U",
    authDomain: "edusmart-8696e.firebaseapp.com",
    projectId: "edusmart-8696e",
    storageBucket: "edusmart-8696e.appspot.com",
    messagingSenderId: "600335013389",
    appId: "1:600335013389:web:2ca195b7593cd76455e744",
    measurementId: "G-MGY3W2SJ5X"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

/* ==========================================================
   2. ROLE SWITCH
   ========================================================== */
window.setRole = function(role) {
    selectedRole = role;
    document.querySelectorAll('#roleSwitch .role-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.role === role);
    });
};

window.setRegisterRole = function(role) {
    registerRole = role;
    document.querySelectorAll('#registerRoleSwitch .role-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(role));
    });
};

/* ==========================================================
   3. AUTH (REGISTER & LOGIN)
   ========================================================== */
window.register = async function() {
    const fullName = document.getElementById('fullName')?.value.trim();
    const email = document.getElementById('registerEmail')?.value.trim();
    const pass = document.getElementById('regPass')?.value;

    if (!fullName || !email || !pass) {
        return alert("Data wajib lengkap.");
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9]).{8,}$/;
    if (!passwordRegex.test(pass)) {
        return alert("Password wajib 8+ karakter, ada huruf besar & angka.");
    }

    try {
        await db.collection("users").add({
            nama_lengkap: fullName,
            email,
            password: pass,
            role: registerRole,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Akun berhasil dibuat!");
        showLogin();

    } catch (e) {
        alert("Gagal: " + e.message);
    }
};

window.login = async function() {
    const email = document.getElementById('loginEmail')?.value.trim();
    const pass = document.getElementById('loginPass')?.value;

    if (!email || !pass) return alert("Isi semua data");

    try {
        const snapshot = await db.collection("users")
            .where("email", "==", email)
            .where("password", "==", pass)
            .where("role", "==", selectedRole)
            .get();

        if (snapshot.empty) {
            return alert("Login gagal / role salah");
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            localStorage.setItem("edusmartUser", JSON.stringify({
                nama_lengkap: data.nama_lengkap,
                email: data.email,
                role: data.role
            }));
        });

        window.location.href = "dashboard.html";

    } catch (e) {
        alert("Error: " + e.message);
    }
};

/* ==========================================================
   4. UI NAVIGATION & PASSWORD TOGGLE
   ========================================================== */
window.showRegister = function() {
    document.getElementById("loginForm").classList.add("hidden");
    document.getElementById("registerForm").classList.remove("hidden");
};

window.showLogin = function() {
    document.getElementById("registerForm").classList.add("hidden");
    document.getElementById("loginForm").classList.remove("hidden");
};

window.togglePass = function(id, btn) {
    const input = document.getElementById(id);
    if (!input) return;

    if (input.type === "password") {
        input.type = "text";
        if (btn) btn.textContent = "🔒";
    } else {
        input.type = "password";
        if (btn) btn.textContent = "👁️";
    }
};

/* ==========================================================
   5. USER UTIL
   ========================================================== */
function getCurrentUser() {
    return JSON.parse(localStorage.getItem("edusmartUser") || "{}");
}

/* ==========================================================
   6. MODAL (SINGLE VERSION - FIX DUPLIKAT)
   ========================================================== */
window.toggleModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.toggle("hidden");
};

/* ==========================================================
   7. INIT MATERI PAGE (BUTTON GURU)
   ========================================================== */
window.initMateriPage = function() {
    const user = getCurrentUser();
    const btn = document.getElementById("featureAction");
btn.onclick = function() {};
    if (!btn) return;

    if (user.role === "guru") {
        btn.style.display = "inline-flex";

        // ⬇️ INI YANG BENAR
        btn.onclick = function () {
            toggleModal("modalTambahMateri");
        };

    } else {
        btn.style.display = "none";
    }

    console.log("INIT MATERI JALAN");

    muatMateri();
};
/* ==========================================================
   8. REALTIME MATERI (FIREBASE)
   ========================================================== */
window.muatMateri = function() {
    const grid = document.getElementById("featureGrid");
    if (!grid) return;

    const user = getCurrentUser();

    db.collection("materi")
        .orderBy("createdAt", "desc")
        .onSnapshot(snapshot => {

            grid.innerHTML = "";

            if (snapshot.empty) {
                grid.innerHTML = "<p>Belum ada materi</p>";
                return;
            }

            snapshot.forEach(doc => {
                const data = doc.data();
                const id = doc.id;

                const isOwner =
                    user.role === "guru" &&
                    user.email === data.email_pengunggah;

                grid.innerHTML += `
                    <div class="card">
                        <h3>${data.judul}</h3>
                        <p>${data.deskripsi}</p>
                        <small>${data.kategori}</small>

                        <div style="margin-top:10px">
                            <a href="${data.link_sumber}" target="_blank">Buka</a>

                            ${user.role === "siswa" ? `
                                <button onclick="simpanMateri('${id}')">⭐</button>
                            ` : ""}

                            ${isOwner ? `
                                <button onclick="editMateri('${id}')">✏️</button>
                                <button onclick="hapusMateri('${id}')">🗑️</button>
                            ` : ""}
                        </div>
                    </div>
                `;
            });
        });
};

/* ==========================================================
   9. TAMBAH MATERI (GURU)
   ========================================================== */
window.simpanMateriBaru = async function() {
    const user = getCurrentUser();

    if (user.role !== "guru") {
        return alert("Hanya guru");
    }
    const db = firebase.firestore();
    const judul = document.getElementById("inputJudulMateri")?.value;
    const deskripsi = document.getElementById("inputDeskripsiMateri")?.value;
    const kategori = document.getElementById("inputKategoriMateri")?.value;
    const link = document.getElementById("inputLinkMateri")?.value;
console.log("KLIK SIMPAN MATERI");
    if (!judul || !deskripsi || !kategori || !link) {
        return alert("Isi semua field");
    }

    try {
        await db.collection("materi").add({
            judul,
            deskripsi,
            kategori,
            link_sumber: link,
            email_pengunggah: user.email,
            nama_pengunggah: user.nama_lengkap,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        bersihkanFormMateri();
        toggleModal("modalTambahMateri");

        alert("Materi ditambahkan");

    } catch (e) {
        alert("Gagal");
    }
};

/* ==========================================================
   10. EDIT MATERI (GURU)
   ========================================================== */
window.editMateri = async function(id) {
    const user = getCurrentUser();
    if (user.role !== "guru") return;

    const doc = await db.collection("materi").doc(id).get();
    const data = doc.data();

    const judul = prompt("Edit Judul:", data.judul);
    const deskripsi = prompt("Edit Deskripsi:", data.deskripsi);

    if (!judul || !deskripsi) return;

    await db.collection("materi").doc(id).update({
        judul,
        deskripsi
    });

    alert("Materi diperbarui");
};

/* ==========================================================
   11. HAPUS MATERI (GURU)
   ========================================================== */
window.hapusMateri = async function(id) {
    const user = getCurrentUser();
    if (user.role !== "guru") return;

    if (!confirm("Hapus materi?")) return;

    await db.collection("materi").doc(id).delete();
    alert("Dihapus");
};

/* ==========================================================
   12. SIMPAN MATERI (SISWA)
   ========================================================== */
window.simpanMateri = async function(idMateri) {
    const user = getCurrentUser();

    if (user.role !== "siswa") return;

    try {
        await db.collection("saved_materi").add({
            user_email: user.email,
            materi_id: idMateri,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Materi disimpan!");

    } catch (e) {
        alert("Gagal simpan");
    }
};

/* ==========================================================
   13. BERSIHKAN FORM
   ========================================================== */
window.bersihkanFormMateri = function() {
    document.getElementById("inputJudulMateri").value = "";
    document.getElementById("inputDeskripsiMateri").value = "";
    document.getElementById("inputKategoriMateri").value = "";
    document.getElementById("inputLinkMateri").value = "";
};

/* ==========================================================
   14. QUIZ SYSTEM (FINAL FIX: ROLE + TIMER + VIEW)
   ========================================================== */

// 🔐 INIT QUIZ PAGE (HIDE BUTTON SISWA)
window.initQuizPage = function() {
    const user = getCurrentUser();
    const btn = document.getElementById("btnTambahQuiz");

    if (!btn) return;

    if (user.role === "guru") {
        btn.style.display = "inline-block";
    } else {
        btn.style.display = "none"; // ❌ siswa tidak bisa lihat tombol
    }
};


// ✅ SIMPAN QUIZ (HANYA GURU)
window.simpanQuizBaru = async function() {
    const user = getCurrentUser();

    // 🔥 PROTEKSI ROLE
    if (user.role !== "guru") {
        return alert("Hanya guru yang bisa membuat quiz!");
    }

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
        alert("Quiz berhasil dibuat!");
        location.reload();

    } catch (e) {
        console.error("ERROR QUIZ:", e);
        alert("Gagal: " + e.message);
    }
};


// ⏱ TIMER QUIZ (ANTI MINUS + FORMAT MENIT:DETIK)
window.mulaiTimerQuiz = function(durasiMenit) {
    let time = durasiMenit * 60;

    clearInterval(quizTimer); // reset kalau sebelumnya ada

    quizTimer = setInterval(() => {

        if (time <= 0) {
            clearInterval(quizTimer);
            document.getElementById("timer").innerText = "0:00";
            alert("Waktu habis!");
            return;
        }

        time--;

        const menit = Math.floor(time / 60);
        const detik = time % 60;

        document.getElementById("timer").innerText =
            `${menit}:${detik < 10 ? '0' : ''}${detik}`;

    }, 1000);
};


// 📥 LOAD QUIZ (ROLE BASED)
window.muatQuiz = function() {
    const user = getCurrentUser();
    const container = document.getElementById("quizContainer");

    if (!container) return;

    db.collection("quizzes")
        .orderBy("createdAt", "desc")
        .onSnapshot(snapshot => {

            container.innerHTML = "";

            if (snapshot.empty) {
                container.innerHTML = "<p>Belum ada quiz</p>";
                return;
            }

            snapshot.forEach(doc => {
                const data = doc.data();
                const id = doc.id;

                // 👨‍🏫 GURU (LIHAT SAJA)
                if (user.role === "guru") {
                    container.innerHTML += `
                        <div class="card">
                            <h3>${data.judul_quiz}</h3>
                            <p>Kelas: ${data.kode_kelas}</p>
                            <p>Durasi: ${data.durasi} menit</p>
                        </div>
                    `;
                }

                // 👨‍🎓 SISWA (KERJAKAN)
                else {
                    container.innerHTML += `
                        <div class="card">
                            <h3>${data.judul_quiz}</h3>
                            <p>Durasi: ${data.durasi} menit</p>

                            <button onclick="kerjakanQuiz('${id}', ${data.durasi})">
                                Kerjakan
                            </button>
                        </div>
                    `;
                }
            });
        });
};


// ✍️ SISWA KERJAKAN QUIZ
window.kerjakanQuiz = async function(idQuiz, durasi) {
    try {
        const doc = await db.collection("quizzes").doc(idQuiz).get();
        const data = doc.data();

        if (!data) return alert("Quiz tidak ditemukan");

        // tampilkan area quiz
        document.getElementById("quizWorkArea").classList.remove("hidden");

        // set judul
        document.getElementById("quizActiveTitle").innerText = data.judul_quiz;

        const soal = data.pertanyaan[0]; // karena kamu masih 1 soal

        // tampilkan soal
        document.getElementById("soalKonten").innerHTML = `
            <p><b>${soal.soal}</b></p>

            <label><input type="radio" name="jawaban" value="a"> ${soal.a}</label><br>
            <label><input type="radio" name="jawaban" value="b"> ${soal.b}</label><br>
            <label><input type="radio" name="jawaban" value="c"> ${soal.c}</label><br><br>

            <button onclick="kumpulkanJawaban('${idQuiz}', '${soal.kunci}')">
                Kumpulkan Jawaban
            </button>
        `;

        mulaiTimerQuiz(durasi);

    } catch (e) {
        console.error(e);
        alert("Gagal load quiz");
    }
};

window.kumpulkanJawaban = function(idQuiz, kunci) {
    const jawaban = document.querySelector('input[name="jawaban"]:checked');

    if (!jawaban) {
        return alert("Pilih jawaban dulu!");
    }

    if (jawaban.value === kunci) {
        alert("Jawaban BENAR ✅");
    } else {
        alert("Jawaban SALAH ❌");
    }

    clearInterval(quizTimer);

    document.getElementById("quizWorkArea").classList.add("hidden");
};
/* ==========================================================
   16. PROFILE PAGE
   ========================================================== */
function initProfilePage() {
    const user = getCurrentUser();

    if (!user.email) {
        window.location.href = "index.html";
        return;
    }

    const name = user.nama_lengkap || "Tidak ada nama";

    document.getElementById("profileName").textContent = name;
    document.getElementById("detailName").textContent = name;
    document.getElementById("profileRole").textContent = user.role.toUpperCase();
    document.getElementById("detailEmail").textContent = user.email;
    document.getElementById("detailRole").textContent = user.role;

    document.getElementById("avatarBox").textContent =
        name.substring(0, 2).toUpperCase();
}

/* ==========================================================
   17. LOGOUT
   ========================================================== */
function logout() {
    localStorage.removeItem("edusmartUser");
    window.location.href = "index.html";
}