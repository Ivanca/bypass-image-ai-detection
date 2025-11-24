
const startDragAndDrop = ({ dropTarget, onImageDropped, onError }) => {
    if (!dropTarget) {
        throw new Error("startDragAndDrop requires a dropTarget element");
    }

    if (typeof onImageDropped !== "function") {
        throw new Error("startDragAndDrop requires an onImageDropped callback");
    }

    const safeError = (message) => {
        if (typeof onError === "function") {
            onError(message);
        } else {
            console.warn(message);
        }
    };

    let dragDepth = 0;

    const addHighlight = () => dropTarget.classList.add("drag-over");
    const removeHighlight = () => dropTarget.classList.remove("drag-over");

    const handleDragEnter = (event) => {
        event.preventDefault();
        event.stopPropagation();
        dragDepth += 1;
        addHighlight();
    };

    const handleDragOver = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!event.dataTransfer) {
            return;
        }
        event.dataTransfer.dropEffect = "copy";
    };

    const handleDragLeave = (event) => {
        event.preventDefault();
        event.stopPropagation();
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) {
            removeHighlight();
        }
    };

    const handleDrop = (event) => {
        event.preventDefault();
        event.stopPropagation();
        dragDepth = 0;
        removeHighlight();

        const file = event.dataTransfer?.files?.[0];
        if (!file) {
            safeError("No file detected in drop event");
            return;
        }

        if (!file.type.startsWith("image/")) {
            safeError("Please drop an image file");
            return;
        }

        onImageDropped(file);
    };

    const events = [
        ["dragenter", handleDragEnter],
        ["dragover", handleDragOver],
        ["dragleave", handleDragLeave],
        ["drop", handleDrop]
    ];

    events.forEach(([name, handler]) => dropTarget.addEventListener(name, handler));

    return () => {
        events.forEach(([name, handler]) => dropTarget.removeEventListener(name, handler));
    };
};

export { startDragAndDrop };