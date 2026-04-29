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
    const now = new Date();
    // Subtract days in UTC to avoid DST issues, then format in SGT
    const past = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Singapore',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(past);
};
