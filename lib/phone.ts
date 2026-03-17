export function normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '')

    if (digits.length === 10) return `+1${digits}`
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`

    // fallback for messy input
    const last10 = digits.slice(-10)
    return last10.length === 10 ? `+1${last10}` : `+${digits}`
}

export function formatPhoneDisplay(phone: string): string {
    const digits = phone.replace(/\D/g, '').slice(-10)
    if (digits.length !== 10) return phone
    return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}