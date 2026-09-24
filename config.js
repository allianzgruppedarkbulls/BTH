
const CONFIG = {
   
    SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxKqeywH3IUxTzIPCjYCyHKcXscPXATS2rLhLjr34t-GwFHA1gquokSMzmsF8mR7TxHwA/exec",
    

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
