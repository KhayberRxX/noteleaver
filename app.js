const URL = "https://ssfgvjudifodfhovhpzx.supabase.co";
const KEY = "sb_publishable_hBGvHNaGoHd_5cLAKVUhqA_N87pXWQo";
const supabaseClient = supabase.createClient(URL, KEY);

const App = {
    room: 'main',
    cam: { x: window.innerWidth/2, y: window.innerHeight/2, z: 1 },
    drag: { active: false, hasMoved: false, startX: 0, startY: 0 },
    mouse: { x: 0, y: 0 },
    lastAction: 0,
    isAdmin: localStorage.getItem('isAdm') === 'true',
    uid: 'GEO-' + Math.floor(Math.random()*9999),

    async init() {
        this.bindEvents();
        this.setupRealtime();
        await this.changeRoom('main');
        if(this.isAdmin) Admin.refresh();
    },

    setupRealtime() {
        const chan = supabaseClient.channel('meta_live', { config: { presence: { key: this.uid } } });
        
        chan.on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => this.loadItems())
            .on('presence', { event: 'sync' }, () => this.updatePresence(chan.presenceState()))
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') await chan.track({ x: 0, y: 0, room: this.room });
            });
        this.liveChan = chan;
    },

    bindEvents() {
        const vp = document.getElementById('viewport');
        
        vp.onmousedown = (e) => {
            if(e.button !== 0) return;
            this.drag.active = true;
            this.drag.hasMoved = false;
            this.drag.startX = e.clientX - this.cam.x;
            this.drag.startY = e.clientY - this.cam.y;
        };

        window.onmousemove = (e) => {
            if(this.drag.active) {
                const dx = e.clientX - (this.drag.startX + this.cam.x);
                const dy = e.clientY - (this.drag.startY + this.cam.y);
                if(Math.abs(dx) > 4 || Math.abs(dy) > 4) this.drag.hasMoved = true;

                this.cam.x = e.clientX - this.drag.startX;
                this.cam.y = e.clientY - this.drag.startY;
                this.render();
            }
            this.mouse.x = Math.round((e.clientX - this.cam.x) / this.cam.z);
            this.mouse.y = Math.round((e.clientY - this.cam.y) / this.cam.z);
            document.getElementById('stat-coords').innerText = `${this.mouse.x}, ${this.mouse.y}`;
            if(this.drag.active) this.liveChan.track({ x: this.mouse.x, y: this.mouse.y, room: this.room });
        };

        window.onmouseup = (e) => {
            if(this.drag.active && !this.drag.hasMoved) UI.openCreator();
            this.drag.active = false;
        };

        vp.onwheel = (e) => {
            const s = e.deltaY > 0 ? 0.9 : 1.1;
            this.cam.z = Math.min(Math.max(0.2, this.cam.z * s), 4);
            this.render();
        };
    },

    render() {
        document.getElementById('camera').style.transform = `translate(${this.cam.x}px, ${this.cam.y}px) scale(${this.cam.z})`;
    },

    async changeRoom(rid) {
        this.room = rid;
        document.getElementById('room-name').innerText = rid.toUpperCase();
        document.getElementById('btn-back').classList.toggle('hidden', rid === 'main');
        this.cam.x = window.innerWidth/2; this.cam.y = window.innerHeight/2;
        this.render();
        await this.loadItems();
        if(this.liveChan) this.liveChan.track({ x: 0, y: 0, room: rid });
    },

    async loadItems() {
        const { data } = await supabaseClient.from('items').select('*').eq('room_id', this.room);
        const layer = document.getElementById('entities-layer');
        layer.innerHTML = '';
        data?.forEach(item => {
            const div = document.createElement('div');
            div.className = `entity ${item.type}`;
            div.style.left = item.x + 'px'; div.style.top = item.y + 'px';
            const adm = this.isAdmin ? `<i class="fa-solid fa-trash" onclick="Admin.deleteItem(${item.id})"></i>` : '';
            div.innerHTML = `<h4>${item.title} <div>${adm} <i class="fa-solid fa-flag" onclick="App.report(${item.id})"></i></div></h4><p>${item.content}</p>`;
            if(item.type === 'library') div.onclick = (e) => { e.stopPropagation(); this.changeRoom(item.title); };
            layer.appendChild(div);
        });
    },

    updatePresence(state) {
        const layer = document.getElementById('players-layer');
        const admList = document.getElementById('adm-user-list');
        layer.innerHTML = ''; admList.innerHTML = '';
        let count = 0;
        for(let id in state) {
            count++;
            const p = state[id][0];
            if(id === this.uid) continue;
            if(p.room === this.room) {
                const d = document.createElement('div');
                d.className = 'player-dot'; // CSS'e nokta stilini ekle
                d.style.left = p.x + 'px'; d.style.top = p.y + 'px';
                layer.appendChild(d);
            }
            if(this.isAdmin) {
                const div = document.createElement('div');
                div.className = 'a-item';
                div.innerHTML = `<span>${id}</span> <button onclick="Admin.tp(${p.x}, ${p.y}, '${p.room}')">GİT</button>`;
                admList.appendChild(div);
            }
        }
        document.getElementById('stat-online').innerText = count;
    },

    async report(id) {
        await supabaseClient.from('items').update({ is_reported: true }).eq('id', id);
        alert("Bildirim iletildi.");
    }
};

const UI = {
    openCreator() {
        const now = Date.now();
        if(now - App.lastAction < 30000 && !App.isAdmin) return;
        const ovl = document.getElementById('modal-overlay');
        const box = document.getElementById('modal-box');
        ovl.style.display = 'flex';
        box.innerHTML = `
            <h2>YENİ OLUŞUM</h2>
            <input id="in-t" placeholder="Başlık (Kütüphane ise oda adı)">
            <textarea id="in-c" placeholder="İçerik..."></textarea>
            <select id="in-type"><option value="note">Not</option><option value="library">Kütüphane</option></select>
            <button class="btn-prime" onclick="UI.submit()">DÜNYAYA SAL</button>
            <button class="btn-sec" onclick="UI.close()">İPTAL</button>
        `;
    },
    async submit() {
        const t = document.getElementById('in-t').value;
        const c = document.getElementById('in-c').value;
        const type = document.getElementById('in-type').value;
        if(!t || !c) return;
        await supabaseClient.from('items').insert([{ title: t, content: c, type, x: App.mouse.x, y: App.mouse.y, room_id: App.room }]);
        App.lastAction = Date.now();
        this.startCooldown();
        this.close();
    },
    startCooldown() {
        const bar = document.getElementById('cooldown-bar');
        bar.style.width = '100%';
        setTimeout(() => { bar.style.transition = 'width 30s linear'; bar.style.width = '0%'; }, 100);
    },
    close() { document.getElementById('modal-overlay').style.display = 'none'; }
};

const Admin = {
    toggle() {
        if(!App.isAdmin) {
            if(prompt("PASS:") === "Hasan024") { localStorage.setItem('isAdm', 'true'); location.reload(); }
        } else { document.body.classList.toggle('admin-open'); this.refresh(); }
    },
    async refresh() {
        const { count: total } = await supabaseClient.from('items').select('*', { count: 'exact', head: true });
        const { data: reports } = await supabaseClient.from('items').select('*').eq('is_reported', true);
        document.getElementById('adm-total').innerText = total;
        document.getElementById('adm-reports').innerText = reports?.length || 0;
        const list = document.getElementById('adm-report-list');
        list.innerHTML = '';
        reports?.forEach(r => {
            const d = document.createElement('div');
            d.innerHTML = `${r.title} <button onclick="Admin.tp(${r.x}, ${r.y}, '${r.room_id}')">GİT</button>`;
            list.appendChild(d);
        });
    },
    tp(x, y, rid) {
        if(App.room !== rid) App.changeRoom(rid);
        setTimeout(() => { App.cam.x = window.innerWidth/2 - x; App.cam.y = window.innerHeight/2 - y; App.render(); }, 400);
    },
    async deleteItem(id) { if(confirm("Silinsin mi?")) await supabaseClient.from('items').delete().eq('id', id); }
};

App.init();
