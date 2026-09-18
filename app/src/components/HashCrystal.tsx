"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * A smaller companion to SealObject, for the proof section: a faceted
 * crystal in the signal blue, turning against its own axis, standing in for
 * the fingerprint being checked. Same recipe, lighter footprint, no shadows.
 */
export function HashCrystal() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const el = canvasRef.current;
        if (!el) return;
        const canvas: HTMLCanvasElement = el;

        // THREE.WebGLRenderer acquires the canvas's rendering context itself.
        // Don't call canvas.getContext() beforehand, a canvas can bind only one
        // context type ever, and a manual probe here would starve the renderer.
        const renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            alpha: true,
        });
        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
        camera.position.set(0, 0, 4.6);

        const geo = new THREE.OctahedronGeometry(1.15, 0);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x7fa9e8,
            metalness: 0.4,
            roughness: 0.22,
            emissive: 0x0b1a30,
            emissiveIntensity: 0.35,
            flatShading: true,
        });
        const crystal = new THREE.Mesh(geo, mat);
        scene.add(crystal);

        scene.add(new THREE.AmbientLight(0xffffff, 0.55));

        const key = new THREE.DirectionalLight(0xffffff, 3.0);
        key.position.set(2.4, 3.0, 4.0);
        scene.add(key);

        const fill = new THREE.DirectionalLight(0x9bc3ef, 0.7);
        fill.position.set(-2.2, 0.6, 3.0);
        scene.add(fill);

        const rim = new THREE.DirectionalLight(0x4fb286, 1.2);
        rim.position.set(-3.0, -1.0, -2.4);
        scene.add(rim);

        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        let raf = 0;
        let visible = true;

        function resize() {
            const w = Math.max(1, canvas.clientWidth);
            const h = Math.max(1, canvas.clientHeight);
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        }

        function render(time = 0) {
            const t = time * 0.001;
            crystal.rotation.x = t * 0.32;
            crystal.rotation.y = t * 0.46;
            crystal.position.y = reduce ? 0 : Math.sin(t * 0.9) * 0.08;

            renderer.render(scene, camera);
            if (!reduce && visible) raf = requestAnimationFrame(render);
        }

        function onResize() {
            cancelAnimationFrame(raf);
            resize();
            render();
        }

        function onVisibility() {
            visible = !document.hidden;
            cancelAnimationFrame(raf);
            if (visible && !reduce) raf = requestAnimationFrame(render);
        }

        resize();
        render();
        window.addEventListener("resize", onResize);
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", onResize);
            document.removeEventListener("visibilitychange", onVisibility);
            geo.dispose();
            mat.dispose();
            renderer.dispose();
        };
    }, []);

    return (
        <div className="relative w-full aspect-square max-w-[9rem] mx-auto">
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
        </div>
    );
}