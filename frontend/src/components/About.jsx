import React, { useEffect, useRef } from "react";
import 'animate.css';
import { Link } from 'react-router-dom';

const About = () => {
  const matrixRef = useRef(null);
  const fireRef = useRef(null);

  // ====== Matrix Rain ======
  useEffect(() => {
    const canvas = matrixRef.current;
    const ctx = canvas.getContext("2d", { alpha: true });

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const fontSize = Math.max(12, Math.floor(w / 80));
    const columns = Math.floor(w / fontSize);
    let drops = new Array(columns).fill(1 + Math.random() * 100);

    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const purple = ["#A21CAF", "#C026D3", "#D946EF", "#E879F9", "#7C3AED", "#6D28D9"];

    let animationId;
    const draw = () => {
      ctx.fillStyle = "rgba(10, 0, 15, 0.2)";
      ctx.fillRect(0, 0, w, h);

      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillStyle = purple[Math.floor(Math.random() * purple.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        // 속도 0.3, 밀도 0.3 고정
        const fall = (Math.random() * 1.5 + 0.8) * 0.3;
        drops[i] += fall;
        if (drops[i] * fontSize > h && Math.random() > (0.975 - 0.3 * 0.25)) {
          drops[i] = 0;
        }
      }
      animationId = requestAnimationFrame(draw);
    };

    const handleResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      const newColumns = Math.floor(w / fontSize);
      drops = new Array(newColumns).fill(1 + Math.random() * 100);
    };

    window.addEventListener("resize", handleResize);
    draw();
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // ====== Fireworks on Scroll ======
  useEffect(() => {
    const canvas = fireRef.current;
    const ctx = canvas.getContext("2d", { alpha: true });

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const gravity = 0.06;
    const particles = [];
    let raf;

    class Particle {
      constructor(x, y, angle, speed) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.alpha = 1;
        this.life = 60 + Math.random() * 30;
        this.size = 2 + Math.random() * 2.5;
        this.color = `hsl(${280 + Math.random() * 50}, 90%, ${50 + Math.random() * 30}%)`;
        this.trail = [];
      }
      update() {
        this.trail.push({ x: this.x, y: this.y, alpha: this.alpha });
        if (this.trail.length > 6) this.trail.shift();

        this.x += this.vx;
        this.y += this.vy;
        this.vy += gravity * 0.5;
        this.alpha -= 0.015 + Math.random() * 0.01;
        this.life--;
      }
      draw(ctx) {
        for (let i = 0; i < this.trail.length; i++) {
          const t = this.trail[i];
          ctx.globalAlpha = t.alpha * 0.4;
          ctx.beginPath();
          ctx.arc(t.x, t.y, this.size * (i / this.trail.length), 0, Math.PI * 2);
          ctx.fillStyle = this.color;
          ctx.fill();
        }
        ctx.globalAlpha = Math.max(this.alpha, 0);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      alive() {
        return this.alpha > 0 && this.life > 0;
      }
    }

    function burst(x, y) {
      const count = 70 + Math.floor(Math.random() * 50);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.1;
        const sp = 2 + Math.random() * 4;
        particles.push(new Particle(x, y, angle, sp));
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(25, 0, 35, 0.12)";
      ctx.fillRect(0, 0, w, h);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw(ctx);
        if (!p.alive()) particles.splice(i, 1);
      }
      raf = requestAnimationFrame(animate);
    };

    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };

    let cooldown = 0;
    const onWheel = (e) => {
      const now = performance.now();
      if (now - cooldown < 200) return;
      cooldown = now;
      const x = Math.random() * w * 0.9 + w * 0.05;
      const y = e.deltaY > 0 ? (Math.random() * h * 0.4 + h * 0.1) : (Math.random() * h * 0.4 + h * 0.4);
      burst(x, y);
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("wheel", onWheel, { passive: true });
    animate();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("wheel", onWheel);
    };
  }, []);

  return (
    <div className="AboutBG">
      <canvas ref={matrixRef} className="matrix-layer" />
      <canvas ref={fireRef} className="fireworks-layer" />

      <div className="about-hero">
        <h1 className="neon-title">Podo Village</h1>
        <p className="neon-sub">공부 놀이터</p>
        <div className="cta-group">
          <Link to="/study" className="cta-btn">Start Study</Link>
          <Link to="/paper" className="cta-btn alt">Explore Papers</Link>
          <Link to="/wiki" className="cta-btn ghost">Open Wiki</Link>
        </div>
        <div className="scroll-cue">Scroll to Celebrate 🎆</div>
      </div>
      
      {/* 하단 소개 섹션(기존 섹션 대체 요약) */}
      <div className="about-sections">
        <SectionCard title="Study">
          자격증/시험 대비 모범답안을 쓰고 피드백을 주고받는 공간.
        </SectionCard>
        <SectionCard title="Paper">
          학술/학위 논문에서 핵심만 쏙쏙. 인사이트를 구조화하세요.
        </SectionCard>
        <SectionCard title="Wiki">
          여러 사람이 함께 개념을 설명하는 협업 지식 베이스.
        </SectionCard>
      </div>
    </div>
  );
};


// 간단한 카드(새 컴포넌트 파일 생성 없이 내부 함수로)
function SectionCard({ title, children }) {
  return (
    <div className="section-card">
      <h3>{title}</h3>
      <p>{children}</p>
      <div className="card-glow" />
    </div>
  );
}

export default About;
