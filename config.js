const CONFIG = {
    SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxbyVziKxsSpdvxQp3lckXUSM-H1RvTE5P5JjfROAyZ7xd0wdTTAl1H_iqn-DBzooMWmQ/exec",
    APP_NAME: "BTH PLANWERK",
    VERSION: "2.5.0",
    
    async apiCall(action, payload = {}) {
        try {
            const response = await fetch(this.SCRIPT_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8", 
                },
                body: JSON.stringify({ action, ...payload })
            });
            const result = await response.json();
            return result;
        } catch (error) {
            console.error("API-Fehler bei Aktion:", action, error);
            return { success: false, error: error.message };
        }
    }
};

// Kompatibilitätsschicht für Skripte, die BTH_CONFIG erwarten:
const BTH_CONFIG = {
    webAppUrl: CONFIG.SCRIPT_URL,
    scriptUrl: CONFIG.SCRIPT_URL
};
