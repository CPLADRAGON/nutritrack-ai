export const getSingaporeDate = (): string => {
    // Returns YYYY-MM-DD in Singapore Time
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Singapore',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(new Date());
};

export const getSingaporeTime = (): string => {
    // Returns HH:mm in Singapore Time
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Singapore',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    return formatter.format(new Date());
};

export const getSingaporePastDate = (daysAgo: number): string => {
    // Get current time in SGT
    const nowStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Singapore' });
    const sgDate = new Date(nowStr);

    // Subtract days
    sgDate.setDate(sgDate.getDate() - daysAgo);

    // Format manually to YYYY-MM-DD to avoid timezone shifts back to local
    const year = sgDate.getFullYear();
    const month = String(sgDate.getMonth() + 1).padStart(2, '0');
    const day = String(sgDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
