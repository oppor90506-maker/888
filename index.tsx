// bundle/src/plugins/OrbsDisplay/index.tsx
// Endcord Mobile plugin — OrbsDisplay
// Shows a customisable Orbs badge next to your name in chat.
// Client-side only: the number, icon and colour are yours alone.

import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default definePlugin({
    id: "endcord.orbsDisplay",
    name: "OrbsDisplay",
    description: tx("Show a custom Orbs count next to your name (local only, never changes your real balance)"),

    settings: {
        orbsValue: {
            type: "string",
            label: tx("Orbs value to display"),
            default: "9999",
        },
        orbsIcon: {
            type: "string",
            label: tx("Orbs icon (emoji or text)"),
            default: "🔮",
        },
        orbsColor: {
            type: "string",
            label: tx("Badge colour (hex, e.g. #a855f7)"),
            default: "#a855f7",
        },
        glowEffect: {
            type: "boolean",
            label: tx("Glow effect"),
            default: true,
        },
        fadeEffect: {
            type: "boolean",
            label: tx("Fade-in animation"),
            default: true,
        },
        pulseEffect: {
            type: "boolean",
            label: tx("Pulse animation on icon"),
            default: false,
        },
    },

    start({ store, cleanup }) {
        // Inject the Orbs badge into every message row that belongs to you.
        cleanup(
            onMessageRow((row, message) => {
                // Only add the badge to your own messages.
                const currentUser = getCurrentUser?.();
                if (!currentUser || message.author.id !== currentUser.id) return;

                const color  = store.orbsColor  || "#a855f7";
                const icon   = store.orbsIcon   || "🔮";
                const value  = Number(store.orbsValue || "9999").toLocaleString();

                const badge = (
                    <OrbsBadge
                        icon={icon}
                        value={value}
                        color={color}
                        glow={store.glowEffect}
                        fade={store.fadeEffect}
                        pulse={store.pulseEffect}
                    />
                );

                // Append the badge after the author name area.
                row.nameExtra = badge;
            }),
        );
    },
});

// ─── Badge component ────────────────────────────────────────────────────────

interface OrbsBadgeProps {
    icon: string;
    value: string;
    color: string;
    glow: boolean;
    fade: boolean;
    pulse: boolean;
}

function OrbsBadge({ icon, value, color, glow, fade, pulse }: OrbsBadgeProps) {
    const [opacity, setOpacity] = React.useState(fade ? 0 : 1);
    const [iconScale, setIconScale] = React.useState(1);

    // Fade-in on mount
    React.useEffect(() => {
        if (!fade) return;
        let frame: number;
        let start: number | null = null;
        const duration = 400;
        const animate = (ts: number) => {
            if (!start) start = ts;
            const progress = Math.min((ts - start) / duration, 1);
            setOpacity(progress);
            if (progress < 1) frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frame);
    }, [fade]);

    // Pulse loop on icon
    React.useEffect(() => {
        if (!pulse) return;
        let frame: number;
        const animate = (ts: number) => {
            const scale = 1 + 0.2 * Math.sin((ts / 1800) * Math.PI * 2);
            setIconScale(scale);
            frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frame);
    }, [pulse]);

    const bg      = hexToRgba(color, 0.13);
    const border  = hexToRgba(color, 0.55);
    const shadow  = glow ? color : "transparent";

    return (
        <View
            style={[
                styles.badge,
                {
                    opacity,
                    backgroundColor: bg,
                    borderColor: border,
                    // React Native does not support text-shadow on View,
                    // but shadowColor gives a soft glow on iOS.
                    shadowColor: shadow,
                    shadowRadius: glow ? 6 : 0,
                    shadowOpacity: glow ? 0.9 : 0,
                    elevation: glow ? 4 : 0,   // Android glow
                },
            ]}
            accessibilityLabel={`Orbs: ${value}`}
        >
            <Text
                style={[
                    styles.icon,
                    pulse && { transform: [{ scale: iconScale }] },
                ]}
            >
                {icon}
            </Text>
            <Text style={[styles.value, { color }]}>{value}</Text>
        </View>
    );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    badge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 10,
        borderWidth: 1,
        marginLeft: 6,
        // Keep it inline with the name line
        alignSelf: "center",
    },
    icon: {
        fontSize: 13,
        lineHeight: 18,
    },
    value: {
        fontSize: 12,
        fontWeight: "800",
        letterSpacing: 0.4,
    },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a 6-digit hex colour + alpha to an rgba() string. */
function hexToRgba(hex: string, alpha: number): string {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}
