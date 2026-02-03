// Ensure the object and property exist before accessing
if (typeof MappingForm === 'undefined') {
    console.error('MappingForm is not defined. Adding fallback initialization.');
    var MappingForm = {
        disabledWebsites: []
    };
} else if (!MappingForm.disabledWebsites) {
    console.warn('disabledWebsites is not initialized. Adding fallback initialization.');
    MappingForm.disabledWebsites = [];
}

// Existing logic for MappingForm.disabledWebsites