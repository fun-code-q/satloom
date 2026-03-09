// 12-Player Color Palette for Multiplayer Games
export const PLAYER_COLORS = [
    { primary: '#3b82f6', light: '#60a5fa', dark: '#2563eb', name: 'Blue' },      // Player 1
    { primary: '#ef4444', light: '#f87171', dark: '#dc2626', name: 'Red' },       // Player 2
    { primary: '#10b981', light: '#34d399', dark: '#059669', name: 'Green' },     // Player 3
    { primary: '#f59e0b', light: '#fbbf24', dark: '#d97706', name: 'Orange' },    // Player 4
    { primary: '#8b5cf6', light: '#a78bfa', dark: '#7c3aed', name: 'Purple' },    // Player 5
    { primary: '#ec4899', light: '#f472b6', dark: '#db2777', name: 'Pink' },      // Player 6
    { primary: '#14b8a6', light: '#2dd4bf', dark: '#0d9488', name: 'Teal' },      // Player 7
    { primary: '#f97316', light: '#fb923c', dark: '#ea580c', name: 'Deep Orange' }, // Player 8
    { primary: '#06b6d4', light: '#22d3ee', dark: '#0891b2', name: 'Cyan' },      // Player 9
    { primary: '#84cc16', light: '#a3e635', dark: '#65a30d', name: 'Lime' },      // Player 10
    { primary: '#f43f5e', light: '#fb7185', dark: '#e11d48', name: 'Rose' },      // Player 11
    { primary: '#6366f1', light: '#818cf8', dark: '#4f46e5', name: 'Indigo' },    // Player 12
] as const

export type PlayerColor = typeof PLAYER_COLORS[number]

/**
 * Assign a unique color to a player based on available colors
 */
export function assignPlayerColor(playerIndex: number, takenColors: string[]): PlayerColor {
    const availableColors = PLAYER_COLORS.filter(
        color => !takenColors.includes(color.primary)
    )

    if (availableColors.length === 0) {
        // Fallback: cycle through all colors
        return PLAYER_COLORS[playerIndex % PLAYER_COLORS.length]
    }

    return availableColors[0]
}

/**
 * Get color by primary hex value
 */
export function getColorByPrimary(primary: string): PlayerColor | undefined {
    return PLAYER_COLORS.find(c => c.primary === primary)
}
