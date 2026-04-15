// Lấy các element DOM
const envelope = document.getElementById('envelope');
const envelopeStage = document.getElementById('envelope-stage');
const letterStage = document.getElementById('letter-stage');
const bgMusic = document.getElementById('bg-music');
const canvas = document.getElementById('petal-canvas');
const ctx = canvas.getContext('2d');
const interactiveEnd = document.getElementById('interactive-end');
const secretContent = document.querySelector('.secret-content');
const ctaHint = document.getElementById('cta-hint');

// Setup Canvas kích thước
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Tạo cánh hoa mượt mà bằng Offscreen Canvas thay vì load ảnh nặng
const petalSprite = document.createElement('canvas');
petalSprite.width = 40;
petalSprite.height = 40;
const pCtx = petalSprite.getContext('2d');
pCtx.translate(20, 20);
// Shape cánh hoa
pCtx.beginPath();
pCtx.moveTo(0, -15);
pCtx.bezierCurveTo(15, -18, 18, -3, 12, 10);
pCtx.bezierCurveTo(6, 18, -6, 18, -12, 10);
pCtx.bezierCurveTo(-18, -3, -15, -18, 0, -15);
pCtx.closePath();
// Đổ màu Red Rose gradient
const gradient = pCtx.createLinearGradient(-15, -15, 15, 15);
gradient.addColorStop(0, '#b30000');
gradient.addColorStop(0.5, '#7a0000');
gradient.addColorStop(1, '#400000');
pCtx.fillStyle = gradient;
pCtx.fill();
// Viền sáng nhẹ
pCtx.beginPath();
pCtx.moveTo(-2, -12);
pCtx.bezierCurveTo(5, -12, 8, -5, 5, 2);
pCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
pCtx.lineWidth = 1.5;
pCtx.stroke();

// State của Particle System
let particles = [];
let systemState = 'IDLE'; // IDLE, EXPLODING (Antigravity), FALLING (Gravity), SWEEPING (Interactive)

class Petal {
  constructor(x, y, isExplosion = false, isBottomPile = false) {
    this.initialInit(x, y, isExplosion, isBottomPile);
  }

  initialInit(x, y, isExplosion, isBottomPile) {
    this.x = x !== undefined ? x : Math.random() * canvas.width;
    this.y = y !== undefined ? y : -50;
    
    // Antigravity explosion
    if (isExplosion) {
      this.vx = (Math.random() - 0.5) * 12; // Tản nhẹ hơn
      this.vy = -(Math.random() * 8 + 6); // Bật thấp hơn để bồng bềnh
    } else {
      this.vx = (Math.random() - 0.5) * 2;
      this.vy = Math.random() * 1.5 + 0.5;
    }
    
    // Chế độ gom hoa ở cuối bài
    this.isBottomPile = isBottomPile;
    if (this.isBottomPile) {
      // Xác định khu vực giấu chữ ở cuối scroll
      let bottomOffset = window.innerHeight - 200; 
      this.y = bottomOffset + Math.random() * 200;
      this.vx = 0;
      this.vy = 0;
    }

    this.baseVy = this.vy;
    this.size = Math.random() * 0.5 + 0.3; // scale from 0.3 to 0.8
    this.angle = Math.random() * Math.PI * 2;
    this.spin = (Math.random() - 0.5) * 0.1;
    this.opacity = 1;
    this.dead = false;
  }

  update(mouseX, mouseY, isSwiping, scrollY) {
    if (this.isBottomPile) {
      // Cánh hoa ở dưới đáy sẽ luôn chờ để gạt, không bao giờ rơi hoặc biến mất
      if (mouseX !== null && mouseY !== null) {
        // Tính toạ độ chuột tuyệt đối trên doc
        const absoluteMouseY = mouseY + window.scrollY;
        const dx = this.x - mouseX;
        const dy = this.y - absoluteMouseY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < 120) {
          const force = (120 - dist) / 120;
          this.vx += (dx / dist) * force * 10;
          this.vy += (dy / dist) * force * 10;
        }
      }
      this.vx *= 0.85;
      this.vy *= 0.85;
      this.x += this.vx;
      this.y += this.vy;
      this.angle += this.vx * 0.05 + this.vy * 0.05;
      return; 
    }

    if (systemState === 'EXPLODING') {
      this.vy += 0.15; // Lực hút dịu hơn để lơ lửng
      this.vx *= 0.98; // Lực cán gió
      this.x += this.vx;
      this.y += this.vy;
      this.angle += this.spin;
      
      if (this.y > scrollY + window.innerHeight + 100 && this.vy > 0) {
        this.dead = true;
      }
    } 
    else if (systemState === 'FALLING') {
      // Trôi dạt bồng bềnh nhẹ
      this.x += this.vx * 0.5 + Math.sin(this.y * 0.02) * 1.2;
      this.y += this.vy * 0.6; // Rơi chậm
      this.angle += this.spin * 0.8;
      
      // Mờ dần
      this.opacity -= 0.003; 
      
      if (this.opacity <= 0 || this.y > scrollY + window.innerHeight + 50) {
        this.dead = true;
      }
    }
  }

  draw(ctx, scrollY) {
    // Chỉ render nếu nằm trong phạm vi viewport để tối ưu
    const screenY = this.y - scrollY;
    if (screenY < -100 || screenY > canvas.height + 100) return;

    ctx.save();
    ctx.translate(this.x, screenY);
    ctx.rotate(this.angle);
    ctx.scale(this.size, this.size);
    ctx.globalAlpha = this.opacity;
    // draw image centered
    // draw from cached sprite
    ctx.drawImage(petalSprite, -20, -20);
    ctx.restore();
  }
}

// Logic vòng lặp animation màn hình canvas
let mouseX = null;
let mouseY = null;
let isSwiping = false;

function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Update & Draw particles
  const currentScrollY = window.scrollY;
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update(mouseX, mouseY, isSwiping, currentScrollY);
    if (particles[i].dead) {
      particles.splice(i, 1);
    } else {
      particles[i].draw(ctx, currentScrollY);
    }
  }

  // Check sweep percentage to reveal text and unlock interactions
  if (systemState === 'SWEEPING' && canvas.style.pointerEvents === 'auto') {
    let sweptCount = 0;
    let pileCount = 0;
    
    const rect = secretContent.getBoundingClientRect();
    const docTop = rect.top + window.scrollY;
    
    for (const p of particles) {
      if (p.isBottomPile) {
        pileCount++;
        // Nếu cánh hoa bật ra phạm vi che phủ của box
        if (p.x < rect.left - 50 || p.x > rect.right + 50 || p.y < docTop - 50 || p.y > docTop + rect.height + 50) {
          sweptCount++;
        }
      }
    }
    if (pileCount > 0 && (sweptCount / pileCount) > 0.6) {
       secretContent.classList.add('revealed');
       if (ctaHint) { ctaHint.style.opacity = '0'; }
       // Cho phép chuột đi xuyên qua canvas để người dùng có thể nhấp vào ô nhập liệu
       canvas.style.pointerEvents = 'none'; 
    }
  }

  requestAnimationFrame(loop);
}
// Chạy loop ngay
loop();

// =======================
// SỰ KIỆN TƯƠNG TÁC
// =======================

// 1. Mở bao thư
envelope.addEventListener('click', () => {
  if (envelope.classList.contains('open')) return;
  
  envelope.classList.add('open');
  
  const musicToggle = document.getElementById('music-toggle');
  const musicIcon = document.getElementById('music-icon');
  
  function playBackgroundMusic() {
    bgMusic.volume = 0.4;
    bgMusic.play().then(() => {
        if(musicToggle) musicToggle.classList.remove('hidden');
    }).catch(e => console.log("Trình duyệt chặn phát nhạc: " + e));
  }

  if (musicToggle) {
      musicToggle.addEventListener('click', () => {
          if (bgMusic.paused) {
              bgMusic.play();
              musicToggle.classList.remove('paused');
              musicIcon.textContent = '🎵';
          } else {
              bgMusic.pause();
              musicToggle.classList.add('paused');
              musicIcon.textContent = '🔇';
          }
      });
  }
  
  // Phát nhạc (ignore error nếu trình duyệt không cho autoplay hoặc file rỗng)
  playBackgroundMusic();

  // Kích hoạt Antigravity sau khi animation thẻ thư nở xong (1.5s)
  setTimeout(() => {
    // Chuyển trang
    envelopeStage.classList.remove('active');
    envelopeStage.classList.add('hidden');
    
    letterStage.classList.remove('hidden');
    letterStage.classList.add('active');
    
    // Nổ cánh hoa lấy mốc Y là vị trí thư
    systemState = 'EXPLODING';
    const initY = window.scrollY + canvas.height + 100;
    for (let i = 0; i < 150; i++) {
       particles.push(new Petal(canvas.width/2, initY, true, false));
    }

    // Sau 2s, chuyển sang chế độ Gravity rơi chậm
    setTimeout(() => {
      systemState = 'FALLING';
    }, 2000);
    
  }, 1500);
});

// Flag chống đẻ hoa nhiều lần
let bottomPileSpawned = false;

// 2. Parallax Scroll Event
window.addEventListener('scroll', () => {
  const scrollY = window.scrollY;

  // Kiểm tra nếu scroll đến cuối trang để bật chế độ SWEEPING
  const docHeight = document.documentElement.scrollHeight;
  const viewportHeight = window.innerHeight;
  
  if (scrollY + viewportHeight >= docHeight - 200 && !bottomPileSpawned) {
    bottomPileSpawned = true;
    systemState = 'SWEEPING';
    canvas.style.pointerEvents = 'auto'; // Cho phép chuột scan qua hoa
    
    // Rải 800 cánh hoa để tạo thành một lớp "thảm hoa" đắp kín khu vực
    // Lấy toạ độ tuyệt đối trên body (cộng thêm scrollY)
    const rect = secretContent.getBoundingClientRect();
    const docTop = rect.top + window.scrollY;
    
    for (let i = 0; i < 800; i++) {
        const rx = rect.left - 50 + Math.random() * (rect.width + 100);
        const ry = docTop - 50 + Math.random() * (rect.height + 100);
        particles.push(new Petal(rx, ry, false, true));
    }
  }
});

// 3. Chuột gạt hoa
canvas.addEventListener('mousemove', (e) => {
  if (systemState === 'SWEEPING') {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }
});
canvas.addEventListener('mouseleave', () => {
  mouseX = null;
  mouseY = null;
});

// Touch cho thiết bị di động
canvas.addEventListener('touchmove', (e) => {
  if (systemState === 'SWEEPING') {
    mouseX = e.touches[0].clientX;
    mouseY = e.touches[0].clientY;
  }
});
canvas.addEventListener('touchend', () => {
  mouseX = null;
  mouseY = null;
});

// 4. Form Lời Nhắn
const btnSend = document.getElementById('btn-send-reply');
const replyInput = document.getElementById('reply-message');
const replyStatus = document.getElementById('reply-status');

  if (btnSend && replyInput && replyStatus) {
      btnSend.addEventListener('click', () => {
          const message = replyInput.value.trim();
          if (message !== '') {
              btnSend.textContent = 'Đang gửi...';
              
              // Gửi dữ liệu ẩn danh về Google Form (lưu vào Google Sheet)
              const formUrl = 'https://docs.google.com/forms/d/1EhDmLOc7uhPTzqvaPAQJU7JJ2pIKp5I6PXKnRlB-j2I/formResponse';
              const formData = new URLSearchParams();
              formData.append('entry.1548234475', message);
              formData.append('entry.232833643', message);
              
              fetch(formUrl, {
                  method: 'POST',
                  mode: 'no-cors',
                  headers: {
                      'Content-Type': 'application/x-www-form-urlencoded'
                  },
                  body: formData.toString()
              }).then(() => {
                  btnSend.style.display = 'none';
                  replyInput.style.display = 'none';
                  replyStatus.classList.remove('hidden');
              }).catch(err => {
                  console.error('Submit error:', err);
                  alert('Lỗi mạng! Bạn thử lại sau nhé.');
                  btnSend.textContent = 'Gửi đi';
              });
          } else {
              alert('Bạn viết vài chữ kỉ niệm nhé!');
          }
      });
  }

// --- Train Scene Logic ---
const trainContainer = document.getElementById('train-scene-container');
const trainObj = document.getElementById('train');
const doorLeftObj = document.getElementById('door-left');
const doorRightObj = document.getElementById('door-right');
const girlSil = document.getElementById('girl-silhouette');
const bubbleEl = document.getElementById('farewell-bubble');

if (trainContainer && window.IntersectionObserver) {
    const trainObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !window.trainPlayed) {
            window.trainPlayed = true;
            
            // Bắt đầu chuỗi anime tàu vào ga
            trainObj.classList.add('arriving');
            
            setTimeout(() => {
                doorLeftObj.classList.add('open');
                doorRightObj.classList.add('open');
            }, 7500); // Đợi 7.5s (gần dừng) để mở cửa
            
            setTimeout(() => {
                girlSil.classList.add('step-down');
            }, 8500); // Thả nhân vật
            
            setTimeout(() => {
                girlSil.classList.add('wave');
                bubbleEl.classList.add('show');
            }, 9500); // Bật chào tạm biệt
        }
    }, { threshold: 0.5 }); // Cuộn đến nửa thẻ div thì chạy
    
    trainObserver.observe(trainContainer);
}
