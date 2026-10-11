import { useEffect, useRef } from 'react';

export default function InteractiveCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = 0;
    let height = 0;
    let dpr = window.devicePixelRatio || 1;

    const mouse = {
      x: -1000,
      y: -1000,
      targetX: -1000,
      targetY: -1000,
      isHovering: false,
    };

    const ripples = [];

    const PARTICLE_COUNT = 55;
    const particles = [];

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (particles.length === 0) {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          particles.push(createParticle());
        }
      }
    }

    function createParticle() {

      const colors = [
        'rgba(242, 166, 90, ',
        'rgba(239, 123, 106, ',
        'rgba(244, 236, 220, ',
        'rgba(217, 184, 143, ',
      ];
      const baseColor = colors[Math.floor(Math.random() * colors.length)];
      return {
        x: Math.random() * (width || window.innerWidth),
        y: Math.random() * (height || window.innerHeight),
        baseX: 0,
        baseY: 0,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: Math.random() * 2.2 + 0.8,
        baseAlpha: Math.random() * 0.5 + 0.2,
        colorPrefix: baseColor,
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.015 + Math.random() * 0.02,
      };
    }

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.targetX = e.clientX - rect.left;
      mouse.targetY = e.clientY - rect.top;
      mouse.isHovering = true;
    };

    const handleMouseLeave = () => {
      mouse.isHovering = false;
      mouse.targetX = -1000;
      mouse.targetY = -1000;
    };

    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      if (clickX >= 0 && clickX <= width && clickY >= 0 && clickY <= height) {
        ripples.push({
          x: clickX,
          y: clickY,
          radius: 0,
          maxRadius: Math.min(width, height) * 0.45,
          alpha: 0.7,
          color: Math.random() > 0.5 ? 'rgba(242, 166, 90,' : 'rgba(239, 123, 106,',
        });
      }
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('click', handleClick, { passive: true });

    resize();

    let lastTime = performance.now();

    function render(currentTime) {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      mouse.x += (mouse.targetX - mouse.x) * 0.12;
      mouse.y += (mouse.targetY - mouse.y) * 0.12;

      ctx.clearRect(0, 0, width, height);

      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += dt * 320;
        r.alpha -= dt * 0.9;

        if (r.alpha <= 0 || r.radius >= r.maxRadius) {
          ripples.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(1, (1 - r.radius / r.maxRadius) * 2.5);
        ctx.strokeStyle = `${r.color} ${r.alpha.toFixed(3)})`;
        ctx.stroke();

        const gradient = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, r.radius);
        gradient.addColorStop(0, 'rgba(242, 166, 90, 0)');
        gradient.addColorStop(0.85, 'rgba(242, 166, 90, 0)');
        gradient.addColorStop(1, `${r.color} ${(r.alpha * 0.25).toFixed(3)})`);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.restore();
      }

      if (mouse.isHovering && mouse.x > -500) {
        const cursorGlow = ctx.createRadialGradient(
          mouse.x,
          mouse.y,
          0,
          mouse.x,
          mouse.y,
          240
        );
        cursorGlow.addColorStop(0, 'rgba(242, 166, 90, 0.11)');
        cursorGlow.addColorStop(0.5, 'rgba(239, 123, 106, 0.04)');
        cursorGlow.addColorStop(1, 'rgba(11, 16, 32, 0)');
        ctx.fillStyle = cursorGlow;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 240, 0, Math.PI * 2);
        ctx.fill();
      }

      const CONNECT_DIST = 110;
      const MOUSE_CONNECT_DIST = 160;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.phase += p.pulseSpeed;
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;

        if (mouse.isHovering && mouse.x > -500) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < MOUSE_CONNECT_DIST && dist > 1) {

            const alpha = (1 - dist / MOUSE_CONNECT_DIST) * 0.45;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(242, 166, 90, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 1;
            ctx.stroke();

            p.x += (dx / dist) * 0.4;
            p.y += (dy / dist) * 0.4;
          }
        }

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p2.x - p.x;
          const dy = p2.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECT_DIST) {
            const alpha = (1 - dist / CONNECT_DIST) * 0.16;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(244, 236, 220, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }

        const pulse = Math.sin(p.phase) * 0.25;
        const currentAlpha = Math.max(0.1, Math.min(1, p.baseAlpha + pulse));
        const currentRadius = p.radius * (1 + pulse * 0.3);

        ctx.beginPath();
        ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.colorPrefix}${currentAlpha.toFixed(2)})`;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    }

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('click', handleClick);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="interactive-canvas"
      aria-hidden="true"
    />
  );
}

