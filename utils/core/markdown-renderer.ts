// Simple markdown renderer for chat messages
export function renderMarkdown(text: string): string {
    if (!text) return ""

    return text
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/__(.+?)__/g, '<u>$1</u>')
        .replace(/~~(.+?)~~/g, '<s>$1</s>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/@(\w+)/g, '<span class="mention">@$1</span>')
        .replace(/\n/g, '<br>')
}
