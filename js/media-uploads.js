(function () {
    const MAX_FILE_SIZE = 12 * 1024 * 1024;
    const MAX_IMAGE_DATA_URL_LENGTH = 850000;
    const IMAGE_EDGES = [320, 640, 960];
    const objectUrls = new Set();

    function loadImage(file) {
        return new Promise(function (resolve, reject) {
            const objectUrl = URL.createObjectURL(file);
            const image = new Image();
            image.onload = function () {
                URL.revokeObjectURL(objectUrl);
                resolve(image);
            };
            image.onerror = function () {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('The selected file could not be decoded as an image.'));
            };
            image.src = objectUrl;
        });
    }

    function canvasBlob(canvas, type, quality) {
        return new Promise(function (resolve, reject) {
            canvas.toBlob(function (blob) {
                if (blob) resolve(blob);
                else reject(new Error('The browser could not compress this image.'));
            }, type, quality);
        });
    }

    function blobDataUrl(blob) {
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = function () {
                reject(new Error('The compressed image could not be prepared for publishing.'));
            };
            reader.readAsDataURL(blob);
        });
    }

    function newMediaId() {
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        return Array.from(bytes).map(function (byte) {
            return byte.toString(16).padStart(2, '0');
        }).join('');
    }

    async function compressVariant(image, targetEdge, sourceMaxEdge) {
        let edge = Math.min(targetEdge, sourceMaxEdge);
        let quality = 0.72;

        while (edge >= 1) {
            const scale = edge / sourceMaxEdge;
            const width = Math.max(1, Math.round(image.naturalWidth * scale));
            const height = Math.max(1, Math.round(image.naturalHeight * scale));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');
            if (!context) throw new Error('The browser could not prepare this image.');
            context.drawImage(image, 0, 0, width, height);

            let blob = await canvasBlob(canvas, 'image/webp', quality);
            if (blob.type !== 'image/webp') {
                blob = await canvasBlob(canvas, 'image/jpeg', Math.min(quality, 0.68));
            }
            const dataUrl = await blobDataUrl(blob);
            if (dataUrl.length <= MAX_IMAGE_DATA_URL_LENGTH) {
                return {
                    id: newMediaId(),
                    dataUrl: dataUrl,
                    contentType: blob.type,
                    width: width,
                    height: height
                };
            }

            if (quality > 0.52) {
                quality = Math.max(0.52, quality - 0.1);
            } else {
                if (edge <= 1) break;
                edge = Math.max(1, Math.floor(edge * 0.8));
                quality = 0.72;
            }
        }

        throw new Error('This image is too detailed to fit safely in Firestore. Choose a smaller image.');
    }

    function dataUrlToBlob(dataUrl) {
        const match = /^data:image\/(webp|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
        if (!match) throw new Error('A stored image variant has an invalid format.');
        const binary = atob(match[2]);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return new Blob([bytes], { type: 'image/' + match[1] });
    }

    window.prepareResponsiveImage = async function (file) {
        if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            throw new Error('Choose a JPG, PNG, or WebP image.');
        }
        if (file.size > MAX_FILE_SIZE) {
            throw new Error('Choose an image smaller than 12 MB.');
        }
        if (typeof firebase === 'undefined' || typeof firebase.auth !== 'function'
            || !firebase.auth().currentUser) {
            throw new Error('Sign in as an administrator before preparing images.');
        }

        const image = await loadImage(file);
        const sourceMaxEdge = Math.max(image.naturalWidth, image.naturalHeight);
        const edges = IMAGE_EDGES.filter(function (edge) { return edge < sourceMaxEdge; });
        edges.push(Math.min(sourceMaxEdge, IMAGE_EDGES[IMAGE_EDGES.length - 1]));
        const uniqueEdgesByWidth = new Map();
        edges.forEach(function (edge) {
            const width = Math.max(1, Math.round(image.naturalWidth * edge / sourceMaxEdge));
            uniqueEdgesByWidth.set(width, edge);
        });

        const variants = [];
        for (const edge of Array.from(uniqueEdgesByWidth.values()).sort(function (a, b) { return a - b; })) {
            variants.push(await compressVariant(image, edge, sourceMaxEdge));
        }

        const largest = variants[variants.length - 1];
        return {
            imageVariants: variants,
            imageVariantIds: variants.map(function (variant) { return variant.id; }),
            imageWidth: largest.width,
            imageHeight: largest.height
        };
    };

    window.loadResponsiveImageVariants = async function (variants) {
        if (!Array.isArray(variants) || !variants.length) return [];
        const createdUrls = [];

        try {
            return await Promise.all(variants.map(async function (variant) {
                if (!variant || typeof variant.id !== 'string') return null;
                const snapshot = await db.collection('mediaImages').doc(variant.id).get();
                if (!snapshot.exists) throw new Error('A published image variant is missing.');
                const image = snapshot.data();
                if (typeof image.dataUrl !== 'string') throw new Error('A published image variant is invalid.');
                const objectUrl = URL.createObjectURL(dataUrlToBlob(image.dataUrl));
                objectUrls.add(objectUrl);
                createdUrls.push(objectUrl);
                return {
                    url: objectUrl,
                    width: Number(image.width),
                    height: Number(image.height)
                };
            }));
        } catch (error) {
            createdUrls.forEach(function (url) {
                URL.revokeObjectURL(url);
                objectUrls.delete(url);
            });
            throw error;
        }
    };

    window.revokeResponsiveImageUrls = function () {
        objectUrls.forEach(function (url) { URL.revokeObjectURL(url); });
        objectUrls.clear();
    };

    window.addEventListener('pagehide', window.revokeResponsiveImageUrls);
})();
