// --- app.js İçin Güncel ve Kesin Çözüm ---
const URL = "https://ssfgvjudifodfhovhpzx.supabase.co";
const KEY = "sb_publishable_hBGvHNaGoHd_5cLAKVUhqA_N87pXWQo";
const supabaseClient = supabase.createClient(URL, KEY);

const App = {
    room: 'main',
    cam: { x: window.innerWidth/2, y: window.innerHeight/2, z: 1 },
    drag: { active: false, hasMoved: false, startX: 0, startY: 0 },
    mouse: { x: 0, y: 0 },
    isAdmin: localStorage.getItem('isAdm') === 'true',
    uid: 'GEO-' + Math.floor(Math.random()*9999),

    async init() {
        console.log("Sistem başlatılıyor...");
        // Event listener'ları viewport üzerinden değil, direkt window üzerinden yönetelim (Daha stabil)
        this.bindEvents();
        
        // Supabase bağlantısını test et ve verileri çek
        await this.changeRoom('main');
        this.setupRealtime(); 
        
        this.render();
    },

    bindEvents() {
        // Tıklama ve Sürükleme
        window.addEventListener('mousedown', (e) => {
            // Eğer bir input'a veya butona tıklanmıyorsa sürüklemeyi başlat
            if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
            
            this.drag.active = true;
            this.drag.hasMoved = false;
            this.drag.startX = e.clientX - this.cam.x;
            this.drag.startY = e.clientY - this.cam.y;
        });

        window.addEventListener('mousemove', (e) => {
            if (this.drag.active) {
                this.drag.hasMoved = true;
                this.cam.x = e.clientX - this.drag.startX;
                this.cam.y = e.clientY - this.drag.startY;
                this.render();
            }
            // Koordinat hesaplama
            this.mouse.x = Math.round((e.clientX - this.cam.x) / this.cam.z);
            this.mouse.y = Math.round((e.clientY - this.cam.y) / this.cam.z);
            
            const coordEl = document.getElementById('stat-coords');
            if(coordEl) coordEl.innerText = `${this.mouse.x}, ${this.mouse.y}`;
        });

        window.addEventListener('mouseup', (e) => {
            if (this.drag.active && !this.drag.hasMoved) {
                // Sadece sürükleme yapmadıysa creator aç
                UI.openCreator();
            }
            this.drag.active = false;
        });

        // Zoom (Tekerlek)
        window.addEventListener('wheel', (e) => {
            const s = e.deltaY > 0 ? 0.9 : 1.1;
            this.cam.z = Math.min(Math.max(0.2, this.cam.z * s), 4);
            this.render();
        }, { passive: false });
    },

    render() {
        const camEl = document.getElementById('camera');
        if(camEl) {
            camEl.style.transform = `translate(${this.cam.x}px, ${this.cam.y}px) scale(${this.cam.z})`;
        }
    },

    async loadItems() {
        try {
            const { data, error } = await supabaseClient
                .from('items')
                .select('*')
                .eq('room_id', this.room);
            
            if(error) throw error;

            const layer = document.getElementById('entities-layer');
            layer.innerHTML = '';
            
            data.forEach(item => {
                const div = document.createElement('div');
                div.className = `entity ${item.type}`;
                div.style.left = item.x + 'px';
                div.style.top = item.y + 'px';
                
                // Admin silme butonu
                const deleteBtn = this.isAdmin ? `<i class="fa-solid fa-trash" onclick="Admin.deleteItem(${item.id})"></i>` : '';
                
                div.innerHTML = `
                    <h4>${item.title} <div>${deleteBtn} <i class="fa-solid fa-flag" onclick="App.report(${item.id})"></i></div></h4>
                    <p>${item.content}</p>
                `;

                if(item.type === 'library') {
                    div.style.cursor = 'pointer';
                    div.onclick = (e) => {
                        e.stopPropagation();
                        this.changeRoom(item.title);
                    };
                }
                layer.appendChild(div);
            });
        } catch (err) {
            console.error("Veri yükleme hatası:", err);
        }
    },

    setupRealtime() {
        // Tablo değişikliklerini dinle
        supabaseClient
            .channel('db-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => {
                console.log("Veritabanı güncellendi, veriler yeniden çekiliyor...");
                this.loadItems();
            })
            .subscribe();
    },

    async changeRoom(rid) {
        this.room = rid;
        const roomNameEl = document.getElementById('room-name');
        if(roomNameEl) roomNameEl.innerText = rid.toUpperCase();
        
        // Odaya girince kamerayı sıfırla
        this.cam.x = window.innerWidth / 2;
        this.cam.y = window.innerHeight / 2;
        this.render();
        
        await this.loadItems();
    }
};

// Başlat
window.onload = () => App.init();
