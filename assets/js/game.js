window.onload = function() {
    console.log('window.onload fired');
    // --- DOM ELEMENTS ---
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const socialEnergyEl = document.getElementById('socialEnergy');
    const comfortLevelEl = document.getElementById('comfortLevel');
    const waveEl = document.getElementById('wave');
    const startWaveButton = document.getElementById('startWaveButton');
    const speedToggleButton = document.getElementById('speedToggleButton');
    const fullscreenButton = document.getElementById('fullscreenButton');
    const towerSelectionEl = document.getElementById('tower-selection');
    const modal = document.getElementById('message-modal');
    const modalTitle = document.getElementById('message-title');
    const modalText = document.getElementById('message-text');
    const restartButton = document.getElementById('restart-button');

    // --- GAME STATE ---
    let socialEnergy = 100;
    let comfortLevel = 10;
    let wave = 0;
    let selectedTower = null;
    let towers = [];
    let enemies = [];
    let projectiles = [];
    let gameOver = false;
    let waveInProgress = false;
    let path = [];
    let gameSpeed = 1; // 1 for normal, 2 for fast

    // --- CONFIGURATION ---
    const TILE_SIZE = 50;
    const ENEMY_TYPES = {
        'Small Talk': { baseHealth: 10, baseSpeed: 1, color: '#e53e3e', reward: 5 },
        'Group Chat Notification': { baseHealth: 15, baseSpeed: 1.2, color: '#f6ad55', reward: 8 },
        'Surprise Party': { baseHealth: 100, baseSpeed: 0.8, color: '#38b2ac', reward: 30 },
        'Networking Event': { baseHealth: 20, baseSpeed: 1.5, color: '#805ad5', reward: 10 },
        'Public Speaking Gig': { baseHealth: 150, baseSpeed: 0.7, color: '#718096', reward: 50 },
        'Party Animal': { baseHealth: 40, baseSpeed: 2.2, color: '#ecc94b', reward: 15 },
        'Rumor Mill': { baseHealth: 8, baseSpeed: 2.5, color: '#63b3ed', reward: 4 }
    };
    const WAVES = [
        [], // Wave 0 placeholder
        { count: 5, type: 'Small Talk', scale: 1 },
        { count: 8, type: 'Small Talk', scale: 1.2 },
        { count: 10, type: 'Group Chat Notification', scale: 1.3 },
        { count: 1, type: 'Surprise Party', scale: 1.5 },
        { count: 15, type: 'Networking Event', scale: 1.4 },
        { count: 5, type: 'Public Speaking Gig', scale: 2 },
        { count: 10, type: 'Party Animal', scale: 1.7 },
        { count: 12, type: 'Rumor Mill', scale: 2.2 }
    ];
    const TOWER_TYPES = {
        'Phone Check': { cost: 50, range: 120, damage: 1, fireRate: 30, color: '#3182ce', projectileColor: '#a0deff', description: 'Low dmg, fast fire rate' },
        'Awkward Joke': { cost: 100, range: 150, damage: 5, fireRate: 80, color: '#d69e2e', projectileColor: '#feeeb5', description: 'High dmg, slow fire rate' },
        'Headphones': { cost: 75, range: 90, damage: 0.5, fireRate: 10, color: '#9f7aea', projectileColor: '#e9d8fd', description: 'AoE, rapid but weak' }
    };

    // --- UTILITY FUNCTIONS ---
    function updatePath() {
        // Path is now relative to canvas size
        const w = canvas.width;
        const h = canvas.height;
        const y1 = Math.floor(h / TILE_SIZE / 4) * TILE_SIZE + TILE_SIZE / 2;
        const x1 = Math.floor(w / TILE_SIZE / 3) * TILE_SIZE + TILE_SIZE / 2;
        const y2 = Math.floor(h / TILE_SIZE * 0.7) * TILE_SIZE + TILE_SIZE / 2;
        const x2 = Math.floor(w / TILE_SIZE * 0.75) * TILE_SIZE + TILE_SIZE / 2;
        const y3 = Math.floor(h / TILE_SIZE / 5) * TILE_SIZE + TILE_SIZE / 2;

        path = [
            { x: -TILE_SIZE, y: y1 },
            { x: x1, y: y1 },
            { x: x1, y: y2 },
            { x: x2, y: y2 },
            { x: x2, y: y3 },
            { x: w + TILE_SIZE, y: y3 }
        ];
    }
    function resizeCanvas() {
        const container = canvas.parentElement;
        let size = container.clientWidth;
        if (!size || size < 100) {
            size = 800; // fallback width
            console.warn('Canvas parent width is too small, using fallback size');
        }
        canvas.width = Math.floor(size / TILE_SIZE) * TILE_SIZE;
        canvas.height = Math.floor(canvas.width * 0.75 / TILE_SIZE) * TILE_SIZE;
        console.log('Canvas size:', canvas.width, canvas.height);
        updatePath(); // Recalculate path on resize
        draw(); // Redraw everything after resize
    }
    function getDistance(obj1, obj2) {
        const dx = obj1.x - obj2.x;
        const dy = obj1.y - obj2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // --- CLASSES ---
    class Enemy {
        constructor(typeOrHealth, scaleOrSpeed = 1, maybeType) {
            // Support both new (type, scale) and old (health, speed, type) signatures for backward compatibility
            if (ENEMY_TYPES[typeOrHealth]) {
                // New signature: (type, scale)
                const type = typeOrHealth;
                const scale = scaleOrSpeed || 1;
                const config = ENEMY_TYPES[type];
                this.x = path[0].x;
                this.y = path[0].y;
                this.type = type;
                this.maxHealth = Math.round(config.baseHealth * scale);
                this.health = this.maxHealth;
                this.speed = config.baseSpeed; // Fixed speed per type, no random or scale
                this.reward = Math.round(config.reward * scale);
                this.color = config.color;
            } else {
                // Old signature: (health, speed, type)
                this.x = path[0].x;
                this.y = path[0].y;
                this.maxHealth = typeOrHealth;
                this.health = typeOrHealth;
                this.speed = scaleOrSpeed;
                this.type = maybeType || 'Unknown';
                this.reward = 5;
                this.color = '#e53e3e';
            }
            this.pathIndex = 1;
            this.radius = 15;
        }
        move() {
            if (this.pathIndex >= path.length) return;
            const target = path[this.pathIndex];
            const angle = Math.atan2(target.y - this.y, target.x - this.x);
            this.x += Math.cos(angle) * this.speed;
            this.y += Math.sin(angle) * this.speed;
            if (getDistance(this, target) < this.speed) {
                this.pathIndex++;
            }
        }
        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            // Health bar
            const healthBarWidth = this.radius * 2;
            const healthBarHeight = 5;
            ctx.fillStyle = '#4a5568';
            ctx.fillRect(this.x - this.radius, this.y - this.radius - 10, healthBarWidth, healthBarHeight);
            ctx.fillStyle = '#48bb78';
            ctx.fillRect(this.x - this.radius, this.y - this.radius - 10, healthBarWidth * (this.health / this.maxHealth), healthBarHeight);
            // Draw type label
            ctx.fillStyle = '#fff';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(this.type, this.x, this.y + this.radius + 12);
        }
    }
    class Tower {
        constructor(x, y, type) {
            this.x = x;
            this.y = y;
            this.config = TOWER_TYPES[type];
            this.type = type;
            this.range = this.config.range;
            this.damage = this.config.damage;
            this.fireRate = this.config.fireRate;
            this.color = this.config.color;
            this.projectileColor = this.config.projectileColor;
            this.size = TILE_SIZE * 0.8;
            this.fireCooldown = 0;
            this.upgradeLevel = 0;
            this.maxUpgrades = 2;
            this.baseCost = this.config.cost;
            this._upgradeFlash = 0; // for button flash
        }
        canUpgrade() {
            return this.upgradeLevel < this.maxUpgrades;
        }
        upgrade() {
            if (!this.canUpgrade()) return false;
            this.upgradeLevel++;
            // Example: +20% range, +40% damage, -15% fireRate per upgrade
            this.range = Math.round(this.range * 1.2);
            this.damage = Math.round(this.damage * 1.4 * 10) / 10;
            this.fireRate = Math.max(5, Math.round(this.fireRate * 0.85));
            this.upgradeFlash = 12; // 12 frames of flash
            return true;
        }
        sell() {
            // Refund 70% of total cost (base + upgrades)
            let refund = Math.round((this.baseCost + this.upgradeLevel * (this.baseCost * 0.6)) * 0.7);
            socialEnergy += refund;
            towers = towers.filter(t => t !== this);
            updateUI();
        }
        findTarget() {
            for (let enemy of enemies) {
                if (getDistance(this, enemy) < this.range) {
                    return enemy;
                }
            }
            return null;
        }
        shoot(target) {
            if (this.fireCooldown <= 0) {
                projectiles.push(new Projectile(this.x, this.y, target, this.damage, this.projectileColor));
                this.fireCooldown = this.fireRate;
            }
        }
        update() {
            if (this.fireCooldown > 0) {
                this.fireCooldown--;
            }
            if (this.upgradeFlash > 0) {
                this.upgradeFlash--;
            }
            const target = this.findTarget();
            if (target) {
                this.shoot(target);
            }
        }
        draw() {
            // --- Draw tower shape based on level ---
            let shape = this.upgradeLevel === 0 ? 'square' : (this.upgradeLevel === 1 ? 'rounded' : 'circle');
            ctx.save();
            ctx.fillStyle = this.color;
            if (shape === 'square') {
                ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
                ctx.strokeStyle = '#1a202c';
                ctx.strokeRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
            } else if (shape === 'rounded') {
                ctx.beginPath();
                ctx.roundRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size, 12);
                ctx.fill();
                ctx.strokeStyle = '#1a202c';
                ctx.stroke();
            } else if (shape === 'circle') {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#1a202c';
                ctx.stroke();
            }
            ctx.restore();
            // Draw range circle when placing a new tower
            if (selectedTower && selectedTower.type === this.type) {
                // Get mouse position relative to canvas
                const rect = canvas.getBoundingClientRect();
                const snappedX = Math.floor((mouse.x - rect.left) / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
                const snappedY = Math.floor((mouse.y - rect.top) / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
                if(this.x === snappedX && this.y === snappedY) {
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.stroke();
                }
            }
        }
    }
    class Projectile {
        constructor(x, y, target, damage, color) {
            this.x = x;
            this.y = y;
            this.target = target;
            this.damage = damage;
            this.color = color;
            this.speed = 5;
            this.radius = 5;
        }
        move() {
            if (!this.target || this.target.health <= 0) {
                // Invalidate projectile by moving it off-screen for cleanup
                this.x = -100; 
                return;
            }
            const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            this.x += Math.cos(angle) * this.speed;
            this.y += Math.sin(angle) * this.speed;
        }
        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // --- GAME LOGIC ---
    function spawnWave() {
        console.log('spawnWave called, wave:', wave + 1, WAVES[wave + 1]);
        if (wave + 1 >= WAVES.length) {
            showModal("You've Survived!", "You navigated all social events and made it home. Time to recharge.");
            gameOver = true;
            return;
        }
        wave++;
        waveInProgress = true;
        startWaveButton.disabled = true;
        startWaveButton.classList.add('opacity-50', 'cursor-not-allowed');
        const waveConfig = WAVES[wave];
        let enemiesToSpawn = waveConfig.count;
        const spawnInterval = setInterval(() => {
            if (enemiesToSpawn > 0 && !gameOver) {
                console.log('Spawning enemy', waveConfig.type, waveConfig.scale);
                enemies.push(new Enemy(waveConfig.type, waveConfig.scale));
                enemiesToSpawn--;
            } else {
                clearInterval(spawnInterval);
            }
        }, 1000);
    }
    function update() {
        if (gameOver) return;
        for (let speedStep = 0; speedStep < gameSpeed; speedStep++) {
            // Update enemies
            for (let i = enemies.length - 1; i >= 0; i--) {
                const enemy = enemies[i];
                enemy.move();

                if (enemy.x > canvas.width) {
                    comfortLevel--;
                    enemies.splice(i, 1);
                    if (comfortLevel <= 0) {
                        comfortLevel = 0;
                        gameOver = true;
                        showModal("Overwhelmed!", "Your comfort level dropped to zero. You had to retreat home early.");
                    }
                }
            }

            // Update towers
            towers.forEach(tower => tower.update());

            // Update projectiles
            for (let i = projectiles.length - 1; i >= 0; i--) {
                const p = projectiles[i];
                p.move();

                // Cleanup projectiles that are off-screen or whose target is gone
                if (p.x < 0 || !p.target || p.target.health <= 0) {
                    projectiles.splice(i, 1);
                    continue;
                }

                if (getDistance(p, p.target) < p.radius + 5) { // Hit detection
                    p.target.health -= p.damage;
                    if (p.target.health <= 0) {
                        let enemyIndex = enemies.indexOf(p.target);
                        if (enemyIndex > -1) {
                            enemies.splice(enemyIndex, 1);
                            socialEnergy += p.target.reward; // Reward based on enemy type
                        }
                    }
                    projectiles.splice(i, 1);
                }
            }
        }

        // Check if wave is over (outside speed loop)
        if(waveInProgress && enemies.length === 0) {
            waveInProgress = false;
            startWaveButton.disabled = false;
            startWaveButton.classList.remove('opacity-50', 'cursor-not-allowed');
            socialEnergy += 50 + wave * 10; // End of wave bonus
        }

        updateUI();
    }

    // --- DRAWING ---
    function drawPath() {
        if (path.length < 2) return;
        ctx.strokeStyle = '#4a5568';
        ctx.lineWidth = TILE_SIZE * 0.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.stroke();
        ctx.lineWidth = 1;
    }
    function drawGrid() {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        for (let x = 0; x < canvas.width; x += TILE_SIZE) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += TILE_SIZE) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawPath();
        drawGrid();
        towers.forEach(tower => tower.draw());
        if (selectedTower) {
            drawTowerPlacementPreview();
        }
        enemies.forEach(enemy => enemy.draw());
        projectiles.forEach(p => p.draw());
        drawTowerUpgradeUI();
    }
    function gameLoop() {
        if (!gameOver) {
            update();
            draw();
            requestAnimationFrame(gameLoop);
        }
    }

    // --- UI & INTERACTION ---
    function updateUI() {
        socialEnergyEl.textContent = socialEnergy;
        comfortLevelEl.textContent = comfortLevel;
        waveEl.textContent = wave;
    }
    function createTowerButtons() {
        console.log('createTowerButtons called', TOWER_TYPES);
        towerSelectionEl.innerHTML = '<h2 class="text-xl font-bold text-center text-blue-200 mb-2">Avoidance Tactics</h2>';
        for (const name in TOWER_TYPES) {
            const config = TOWER_TYPES[name];
            const button = document.createElement('button');
            button.className = 'tower-button w-full bg-blue-800 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg border-2 border-transparent';
            button.innerHTML = `
                <div class="flex justify-between items-center">
                    <span>${name}</span>
                    <span class="text-yellow-300">$${config.cost}</span>
                </div>
                <div class="text-xs text-blue-200 text-left mt-1">${config.description}</div>
            `;
            button.onclick = () => selectTower(name, button);
            towerSelectionEl.appendChild(button);
        }
        console.log('Tower buttons created:', towerSelectionEl.children.length);
    }
    let mouse = { x: 0, y: 0 };
    document.addEventListener('mousemove', (e) => {
        // Get mouse position relative to page
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });
    function selectTower(towerName, buttonEl) {
        if (selectedTower && selectedTower.type === towerName) {
            selectedTower = null;
            document.querySelectorAll('.tower-button').forEach(b => b.classList.remove('selected'));
        } else {
            const config = TOWER_TYPES[towerName];
            if (socialEnergy >= config.cost) {
                selectedTower = { type: towerName, config: config };
                document.querySelectorAll('.tower-button').forEach(b => b.classList.remove('selected'));
                buttonEl.classList.add('selected');
            }
        }
    }
    function drawTowerPlacementPreview() {
        const rect = canvas.getBoundingClientRect();
        const snappedX = Math.floor((mouse.x - rect.left) / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
        const snappedY = Math.floor((mouse.y - rect.top) / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;

        // Draw range preview
        ctx.beginPath();
        ctx.arc(snappedX, snappedY, selectedTower.config.range, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fill();

        // Draw tower preview
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = selectedTower.config.color;
        const size = TILE_SIZE * 0.8;
        ctx.fillRect(snappedX - size / 2, snappedY - size / 2, size, size);
        ctx.globalAlpha = 1.0;
    }
    let selectedTowerInstance = null; // For selecting placed towers

    // REMOVE the entire canvas.addEventListener('click', ...) block

    function drawTowerUpgradeUI() {
        if (!selectedTowerInstance) return;
        const x = selectedTowerInstance.x;
        const y = selectedTowerInstance.y - selectedTowerInstance.size / 2 - 10;
        ctx.save();
        // --- Draw range circle for selected tower ---
        ctx.beginPath();
        ctx.arc(selectedTowerInstance.x, selectedTowerInstance.y, selectedTowerInstance.range, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineWidth = 1;
        // Draw shadowed rounded panel
        ctx.globalAlpha = 1;
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = 'rgba(30, 41, 59, 0.97)';
        ctx.beginPath();
        ctx.moveTo(x - 60, y - 60);
        ctx.arcTo(x + 60, y - 60, x + 60, y + 36, 16);
        ctx.arcTo(x + 60, y + 36, x - 60, y + 36, 16);
        ctx.arcTo(x - 60, y + 36, x - 60, y - 60, 16);
        ctx.arcTo(x - 60, y - 60, x + 60, y - 60, 16);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        // --- Upgrade button flash effect (fixed alignment, more obvious) ---
        let upgradeBtnColor = selectedTowerInstance.canUpgrade() ? '#38a169' : '#718096';
        let flashDuration = 700; // ms
        if (selectedTowerInstance._upgradeFlash && Date.now() - selectedTowerInstance._upgradeFlash < flashDuration) {
            // Animate flash: scale and color overlay, aligned to button
            let t = (Date.now() - selectedTowerInstance._upgradeFlash) / flashDuration;
            let scale = 1 + 0.32 * (1 - t); // more scale
            let alpha = 0.85 * (1 - t);
            ctx.save();
            ctx.translate(x, y - 50 + 16); // center of button
            ctx.scale(scale, scale);
            ctx.beginPath();
            ctx.roundRect(-50, -16, 100, 32, 8);
            ctx.fillStyle = 'rgba(255, 255, 0, ' + alpha.toFixed(2) + ')'; // bright yellow
            ctx.shadowColor = 'rgba(255,255,0,0.7)';
            ctx.shadowBlur = 18 * (1 - t);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.lineWidth = 4 + 8 * (1 - t); // border pulse
            ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 * (1 - t)).toFixed(2) + ')';
            ctx.stroke();
            ctx.restore();
        }
        ctx.fillStyle = upgradeBtnColor;
        ctx.beginPath();
        ctx.roundRect(x - 50, y - 50, 100, 32, 8);
        ctx.fill();
        // Fit text in button
        let upgradeText = selectedTowerInstance.canUpgrade() ? `Upgrade ($${Math.round(selectedTowerInstance.baseCost*0.6)})` : 'Maxed';
        let fontSize = 15;
        ctx.font = `bold ${fontSize}px Inter, sans-serif`;
        while (ctx.measureText(upgradeText).width > 90 && fontSize > 10) {
            fontSize--;
            ctx.font = `bold ${fontSize}px Inter, sans-serif`;
        }
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(upgradeText, x, y - 28);
        // Sell button
        ctx.fillStyle = '#e53e3e';
        ctx.beginPath();
        ctx.roundRect(x - 50, y - 10, 100, 32, 8);
        ctx.fill();
        ctx.font = 'bold 15px Inter, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText('Sell', x, y + 12);
        ctx.restore();
    }

    // Improved menu click handling: menu always has priority when open
    let menuClickHandled = false;
    let justPlacedTower = false;

    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const snappedX = Math.floor(mx / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
        const snappedY = Math.floor(my / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;

        // --- MENU HANDLING ---
        if (selectedTowerInstance) {
            const x = selectedTowerInstance.x;
            const y = selectedTowerInstance.y - selectedTowerInstance.size / 2 - 10;
            // Check if click is inside the menu panel
            if (mx > x - 60 && mx < x + 60 && my > y - 60 && my < y + 36) {
                // Upgrade button area
                if (mx > x - 50 && mx < x + 50 && my > y - 50 && my < y - 18) {
                    if (selectedTowerInstance.canUpgrade() && socialEnergy >= Math.round(selectedTowerInstance.baseCost*0.6)) {
                        socialEnergy -= Math.round(selectedTowerInstance.baseCost*0.6);
                        selectedTowerInstance.upgrade();
                        // --- Flash animation for upgrade button ---
                        selectedTowerInstance._upgradeFlash = Date.now();
                        updateUI();
                    }
                }
                // Sell button area
                if (mx > x - 50 && mx < x + 50 && my > y - 10 && my < y + 22) {
                    selectedTowerInstance.sell();
                    selectedTowerInstance = null;
                }
                // Prevent click-through to towers or canvas
                menuClickHandled = true;
                e.stopImmediatePropagation();
                e.preventDefault();
                return;
            }
            // If click is outside the menu, close it
            selectedTowerInstance = null;
            menuClickHandled = false;
            e.stopImmediatePropagation();
            e.preventDefault();
            return;
        }

        // --- TOWER PLACEMENT ---
        if (selectedTower) {
            let onPath = false;
            for(let i=0; i < path.length-1; i++){
                const p1 = path[i];
                const p2 = path[i+1];
                if(snappedX > Math.min(p1.x, p2.x) - TILE_SIZE/2 && snappedX < Math.max(p1.x, p2.x) + TILE_SIZE/2 &&
                   snappedY > Math.min(p1.y, p2.y) - TILE_SIZE/2 && snappedY < Math.max(p1.y, p2.y) + TILE_SIZE/2) {
                    onPath = true;
                    break;
                }
            }
            // Prevent placing on top of another tower
            let onTower = towers.some(tower =>
                Math.abs(tower.x - snappedX) < 1 && Math.abs(tower.y - snappedY) < 1
            );
            if(!onPath && !onTower && socialEnergy >= selectedTower.config.cost) {
                socialEnergy -= selectedTower.config.cost;
                towers.push(new Tower(snappedX, snappedY, selectedTower.type));
                updateUI();
                selectedTower = null;
                document.querySelectorAll('.tower-button').forEach(b => b.classList.remove('selected'));
                justPlacedTower = true;
            }
            selectedTowerInstance = null;
            e.stopImmediatePropagation();
            e.preventDefault();
            return;
        }

        // --- TOWER MENU OPENING ---
        if (justPlacedTower) {
            justPlacedTower = false;
            e.stopImmediatePropagation();
            e.preventDefault();
            return;
        }
        // Not placing, check if clicking a tower
        selectedTowerInstance = null;
        for (let tower of towers) {
            if (Math.abs(tower.x - snappedX) < TILE_SIZE/2 && Math.abs(tower.y - snappedY) < TILE_SIZE/2) {
                selectedTowerInstance = tower;
                break;
            }
        }
        e.stopImmediatePropagation();
        e.preventDefault();
    });

    fullscreenButton.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    });
    startWaveButton.addEventListener('click', () => {
        console.log('Start Wave button clicked, waveInProgress:', waveInProgress);
        if (!waveInProgress) {
            spawnWave();
        }
    });
    speedToggleButton.addEventListener('click', () => {
        gameSpeed = gameSpeed === 1 ? 2 : 1;
        speedToggleButton.textContent = `${gameSpeed === 1 ? 'Normal' : 'Fast'} Speed (${gameSpeed}x)`;
        speedToggleButton.classList.toggle('bg-purple-600', gameSpeed === 1);
        speedToggleButton.classList.toggle('bg-purple-800', gameSpeed === 2);
    });
    function showModal(title, text) {
        modalTitle.textContent = title;
        modalText.textContent = text;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    // Update resetGame to reset speed
    function resetGame() {
        socialEnergy = 100;
        comfortLevel = 10;
        wave = 0;
        towers = [];
        enemies = [];
        projectiles = [];
        gameOver = false;
        waveInProgress = false;

        gameSpeed = 1;
        speedToggleButton.textContent = 'Normal Speed (1x)';
        speedToggleButton.classList.add('bg-purple-600');
        speedToggleButton.classList.remove('bg-purple-800');

        startWaveButton.disabled = false;
        startWaveButton.classList.remove('opacity-50', 'cursor-not-allowed');

        updateUI();
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        gameLoop();
    }
    restartButton.addEventListener('click', resetGame);

    // --- INITIALIZE ---
    window.addEventListener('resize', resizeCanvas, false);
    document.addEventListener('fullscreenchange', resizeCanvas, false);
    createTowerButtons();
    resizeCanvas();
    updateUI();
    gameLoop();
    console.log('Game initialized');
};
