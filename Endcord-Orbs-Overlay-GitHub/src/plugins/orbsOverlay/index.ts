/*
 * Endcord Orbs Overlay
 * Local-only visual customization. Does not read or modify Discord account balance.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { Devs } from "@utils/constants";

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Show the local Orbs floating bubble",
        default: true
    },
    displayValue: {
        type: OptionType.STRING,
        description: "Number shown by the local overlay (not your real balance)",
        default: "9999"
    },
    icon: {
        type: OptionType.STRING,
        description: "Text or emoji used as the Orbs icon",
        default: "✦"
    },
    accentColor: {
        type: OptionType.STRING,
        description: "Floating bubble accent color (CSS color)",
        default: "#A78BFA"
    },
    glow: {
        type: OptionType.BOOLEAN,
        description: "Enable the glow effect",
        default: true
    },
    fadeIn: {
        type: OptionType.BOOLEAN,
        description: "Fade in when the overlay appears",
        default: true
    },
    positionX: {
        type: OptionType.NUMBER,
        description: "Saved horizontal position (managed by dragging)",
        default: -1
    },
    positionY: {
        type: OptionType.NUMBER,
        description: "Saved vertical position (managed by dragging)",
        default: -1
    }
});

const ROOT_ID = "endcord-orbs-overlay-root";
const STYLE_ID = "endcord-orbs-overlay-style";

let root: HTMLDivElement | null = null;
let bubble: HTMLButtonElement | null = null;
let panel: HTMLDivElement | null = null;
let resizeHandler: (() => void) | null = null;
let dragCleanup: (() => void) | null = null;
let isPanelOpen = false;
let dragMoved = false;

const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

function safeColor(value: string): string {
    if (/^#[0-9a-f]{3,8}$/i.test(value) ||
        /^(rgb|rgba|hsl|hsla)\([\d\s.,%+-]+\)$/i.test(value) ||
        /^[a-z]{3,20}$/i.test(value)) return value;
    return "#A78BFA";
}

function savePosition(left: number, top: number) {
    settings.store.positionX = Math.round(left);
    settings.store.positionY = Math.round(top);
}

function applyPosition() {
    if (!root) return;

    const width = bubble?.offsetWidth ?? 76;
    const height = bubble?.offsetHeight ?? 76;
    const defaultLeft = Math.max(8, window.innerWidth - width - 18);
    const defaultTop = Math.round((window.innerHeight - height) / 2);

    const savedX = Number(settings.store.positionX);
    const savedY = Number(settings.store.positionY);
    const left = savedX >= 0 ? savedX : defaultLeft;
    const top = savedY >= 0 ? savedY : defaultTop;

    const finalLeft = clamp(left, 0, Math.max(0, window.innerWidth - width));
    root.style.left = `${finalLeft}px`;
    root.style.top = `${clamp(top, 0, Math.max(0, window.innerHeight - height))}px`;
    root.classList.toggle("ec-orbs-docked-left", finalLeft + width / 2 < window.innerWidth / 2);
}

function updateBubble() {
    if (!bubble) return;
    const color = safeColor(String(settings.store.accentColor || "#A78BFA"));
    const icon = String(settings.store.icon || "✦").slice(0, 8);
    const value = String(settings.store.displayValue ?? "0").slice(0, 24);

    bubble.innerHTML = `
        <span class="ec-orbs-icon">${escapeHtml(icon)}</span>
        <span class="ec-orbs-value">${escapeHtml(value)}</span>
        <span class="ec-orbs-label">ORBS</span>
    `;
    bubble.style.setProperty("--ec-orbs-accent", color);
    bubble.classList.toggle("ec-orbs-glow", Boolean(settings.store.glow));
    bubble.classList.toggle("ec-orbs-fade", Boolean(settings.store.fadeIn));
    bubble.setAttribute("aria-label", `Local Orbs display: ${value}. Click to edit.`);
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]!);
}

function createPanel(): HTMLDivElement {
    const el = document.createElement("div");
    el.className = "ec-orbs-panel";
    el.innerHTML = `
        <div class="ec-orbs-panel-head">
            <div>
                <div class="ec-orbs-panel-title">Orbs 外觀設定</div>
                <div class="ec-orbs-panel-subtitle">僅本機顯示，不會改變真實餘額</div>
            </div>
            <button class="ec-orbs-close" type="button" aria-label="Close">×</button>
        </div>
        <label class="ec-orbs-field">
            <span>顯示數字</span>
            <input class="ec-orbs-number" type="text" inputmode="numeric" maxlength="24">
        </label>
        <label class="ec-orbs-field">
            <span>Orbs 圖示（文字／Emoji）</span>
            <input class="ec-orbs-icon-input" type="text" maxlength="8">
        </label>
        <label class="ec-orbs-field">
            <span>主題顏色</span>
            <input class="ec-orbs-color" type="color">
        </label>
        <label class="ec-orbs-check">
            <input class="ec-orbs-glow-input" type="checkbox">
            <span>發光效果</span>
        </label>
        <label class="ec-orbs-check">
            <input class="ec-orbs-fade-input" type="checkbox">
            <span>淡入效果</span>
        </label>
        <div class="ec-orbs-panel-foot">拖曳圓球可移動位置；點擊圓球可開關此面板。</div>
    `;

    const numberInput = el.querySelector<HTMLInputElement>(".ec-orbs-number")!;
    const iconInput = el.querySelector<HTMLInputElement>(".ec-orbs-icon-input")!;
    const colorInput = el.querySelector<HTMLInputElement>(".ec-orbs-color")!;
    const glowInput = el.querySelector<HTMLInputElement>(".ec-orbs-glow-input")!;
    const fadeInput = el.querySelector<HTMLInputElement>(".ec-orbs-fade-input")!;

    numberInput.value = String(settings.store.displayValue ?? "9999");
    iconInput.value = String(settings.store.icon ?? "✦");
    colorInput.value = /^#[0-9a-f]{6}$/i.test(String(settings.store.accentColor))
        ? String(settings.store.accentColor)
        : "#A78BFA";
    glowInput.checked = Boolean(settings.store.glow);
    fadeInput.checked = Boolean(settings.store.fadeIn);

    numberInput.addEventListener("input", () => {
        settings.store.displayValue = numberInput.value.slice(0, 24);
        updateBubble();
    });
    iconInput.addEventListener("input", () => {
        settings.store.icon = iconInput.value.slice(0, 8);
        updateBubble();
    });
    colorInput.addEventListener("input", () => {
        settings.store.accentColor = colorInput.value;
        updateBubble();
    });
    glowInput.addEventListener("change", () => {
        settings.store.glow = glowInput.checked;
        updateBubble();
    });
    fadeInput.addEventListener("change", () => {
        settings.store.fadeIn = fadeInput.checked;
        updateBubble();
    });

    el.querySelector<HTMLButtonElement>(".ec-orbs-close")!.addEventListener("click", () => {
        setPanelOpen(false);
    });

    el.addEventListener("pointerdown", event => event.stopPropagation());
    el.addEventListener("click", event => event.stopPropagation());
    return el;
}

function setPanelOpen(open: boolean) {
    if (!panel || !bubble) return;
    isPanelOpen = open;
    panel.classList.toggle("ec-orbs-panel-open", open);
    bubble.classList.toggle("ec-orbs-active", open);
}

function beginDrag() {
    if (!bubble || !root) return;

    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;

    const onPointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        pointerId = event.pointerId;
        dragMoved = false;
        startX = event.clientX;
        startY = event.clientY;
        originX = root!.offsetLeft;
        originY = root!.offsetTop;
        bubble!.setPointerCapture(pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
        if (pointerId !== event.pointerId || !root || !bubble) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (Math.abs(dx) + Math.abs(dy) > 4) dragMoved = true;
        if (!dragMoved) return;

        const nextX = clamp(originX + dx, 0, window.innerWidth - bubble.offsetWidth);
        const nextY = clamp(originY + dy, 0, window.innerHeight - bubble.offsetHeight);
        root.style.left = `${nextX}px`;
        root.style.top = `${nextY}px`;
    };

    const onPointerUp = (event: PointerEvent) => {
        if (pointerId !== event.pointerId || !root || !bubble) return;
        if (dragMoved) {
            const centerX = root.offsetLeft + bubble.offsetWidth / 2;
            const snapLeft = centerX < window.innerWidth / 2 ? 8 : window.innerWidth - bubble.offsetWidth - 8;
            root.style.left = `${Math.max(0, snapLeft)}px`;
            root.classList.toggle("ec-orbs-docked-left", snapLeft + bubble.offsetWidth / 2 < window.innerWidth / 2);
            savePosition(root.offsetLeft, root.offsetTop);
        }
        pointerId = null;
    };

    bubble.addEventListener("pointerdown", onPointerDown);
    bubble.addEventListener("pointermove", onPointerMove);
    bubble.addEventListener("pointerup", onPointerUp);
    bubble.addEventListener("pointercancel", onPointerUp);

    dragCleanup = () => {
        bubble?.removeEventListener("pointerdown", onPointerDown);
        bubble?.removeEventListener("pointermove", onPointerMove);
        bubble?.removeEventListener("pointerup", onPointerUp);
        bubble?.removeEventListener("pointercancel", onPointerUp);
    };
}

function injectStyles() {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
        #${ROOT_ID} {
            position: fixed;
            z-index: 999999;
            width: 76px;
            height: 76px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: var(--font-primary, "gg sans", sans-serif);
            user-select: none;
            pointer-events: none;
        }
        #${ROOT_ID} .ec-orbs-bubble {
            pointer-events: auto;
            width: 72px;
            height: 72px;
            border: 1px solid color-mix(in srgb, var(--ec-orbs-accent) 75%, white 25%);
            border-radius: 50%;
            background: color-mix(in srgb, var(--background-floating, #1e1f22) 88%, var(--ec-orbs-accent) 12%);
            color: var(--header-primary, #fff);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 1px;
            cursor: grab;
            touch-action: none;
            padding: 4px;
            box-sizing: border-box;
            transition: transform .16s ease, box-shadow .2s ease, opacity .25s ease;
        }
        #${ROOT_ID} .ec-orbs-bubble:active { cursor: grabbing; transform: scale(.96); }
        #${ROOT_ID} .ec-orbs-icon { color: var(--ec-orbs-accent); font-size: 19px; line-height: 20px; }
        #${ROOT_ID} .ec-orbs-value { color: var(--header-primary, #fff); font-size: 13px; font-weight: 800; line-height: 16px; max-width: 64px; overflow: hidden; text-overflow: ellipsis; }
        #${ROOT_ID} .ec-orbs-label { color: var(--ec-orbs-accent); font-size: 8px; letter-spacing: 1.2px; font-weight: 800; }
        #${ROOT_ID} .ec-orbs-glow { box-shadow: 0 0 10px color-mix(in srgb, var(--ec-orbs-accent) 60%, transparent), 0 0 25px color-mix(in srgb, var(--ec-orbs-accent) 35%, transparent); }
        #${ROOT_ID} .ec-orbs-fade { animation: ec-orbs-in .35s ease both; }
        #${ROOT_ID} .ec-orbs-active { outline: 2px solid var(--ec-orbs-accent); outline-offset: 3px; }
        #${ROOT_ID} .ec-orbs-panel {
            pointer-events: auto;
            position: absolute;
            right: 84px;
            top: 0;
            width: 238px;
            box-sizing: border-box;
            padding: 14px;
            border: 1px solid var(--border-subtle, #3f4147);
            border-radius: 12px;
            background: var(--background-floating, #232428);
            color: var(--header-primary, #fff);
            box-shadow: 0 12px 36px #0008;
            display: none;
            gap: 11px;
        }
        #${ROOT_ID}.ec-orbs-docked-left .ec-orbs-panel { left: 84px; right: auto; }
        #${ROOT_ID} .ec-orbs-panel-open { display: grid; animation: ec-orbs-in .18s ease both; }
        #${ROOT_ID} .ec-orbs-panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
        #${ROOT_ID} .ec-orbs-panel-title { font-size: 14px; font-weight: 800; }
        #${ROOT_ID} .ec-orbs-panel-subtitle, #${ROOT_ID} .ec-orbs-panel-foot { color: var(--text-muted, #b5bac1); font-size: 10px; line-height: 1.4; }
        #${ROOT_ID} .ec-orbs-close { border: 0; background: transparent; color: var(--header-primary, #fff); font-size: 22px; cursor: pointer; line-height: 18px; }
        #${ROOT_ID} .ec-orbs-field { display: grid; gap: 5px; font-size: 11px; color: var(--header-secondary, #b5bac1); }
        #${ROOT_ID} .ec-orbs-field input { width: 100%; min-width: 0; box-sizing: border-box; border: 1px solid var(--input-border, #4e5058); border-radius: 6px; background: var(--input-background, #1e1f22); color: var(--header-primary, #fff); padding: 7px 8px; outline: none; }
        #${ROOT_ID} .ec-orbs-field input:focus { border-color: var(--ec-orbs-accent); }
        #${ROOT_ID} .ec-orbs-field input[type="color"] { height: 32px; padding: 3px; cursor: pointer; }
        #${ROOT_ID} .ec-orbs-check { display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer; }
        #${ROOT_ID} .ec-orbs-check input { accent-color: var(--ec-orbs-accent); }
        @keyframes ec-orbs-in { from { opacity: 0; transform: translateY(5px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @media (max-width: 520px) {
            #${ROOT_ID} .ec-orbs-panel { right: 82px; width: min(238px, calc(100vw - 110px)); }
        }
    `;
    document.head.appendChild(style);
}

function mountOverlay() {
    if (root || !document.body || !settings.store.enabled) return;

    injectStyles();

    root = document.createElement("div");
    root.id = ROOT_ID;

    bubble = document.createElement("button");
    bubble.type = "button";
    bubble.className = "ec-orbs-bubble";
    bubble.addEventListener("click", () => {
        if (dragMoved) {
            dragMoved = false;
            return;
        }
        setPanelOpen(!isPanelOpen);
    });

    panel = createPanel();
    root.append(bubble, panel);
    document.body.appendChild(root);

    updateBubble();
    applyPosition();
    beginDrag();

    resizeHandler = () => applyPosition();
    window.addEventListener("resize", resizeHandler);
}

function unmountOverlay() {
    dragCleanup?.();
    dragCleanup = null;

    if (resizeHandler) window.removeEventListener("resize", resizeHandler);
    resizeHandler = null;

    root?.remove();
    document.getElementById(STYLE_ID)?.remove();

    root = null;
    bubble = null;
    panel = null;
    isPanelOpen = false;
}

export default definePlugin({
    name: "OrbsOverlay",
    description: "Adds a draggable, local-only Orbs display bubble with custom value and appearance.",
    authors: [Devs.rootpoi],
    settings,

    start() {
        mountOverlay();
    },

    stop() {
        unmountOverlay();
    }
});
