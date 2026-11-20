(function () {
    const allowedCollections = ['blogs', 'gallery'];

    window.archiveContent = async function (collectionName, documentId) {
        if (!allowedCollections.includes(collectionName)) {
            throw new Error('This content type cannot be archived.');
        }

        const sourceRef = db.collection(collectionName).doc(documentId);
        const source = await sourceRef.get();
        if (!source.exists) throw new Error('This content was already removed.');

        const archiveRef = db.collection('deletedContent').doc();
        const batch = db.batch();
        batch.set(archiveRef, {
            sourceCollection: collectionName,
            sourceId: documentId,
            record: source.data(),
            deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
            deletedBy: firebase.auth().currentUser.uid
        });
        batch.delete(sourceRef);
        await batch.commit();
    };

    window.restoreArchivedContent = async function (archiveId, collectionName) {
        if (!allowedCollections.includes(collectionName)) {
            throw new Error('This content type cannot be restored.');
        }

        const archiveRef = db.collection('deletedContent').doc(archiveId);
        const archive = await archiveRef.get();
        if (!archive.exists) throw new Error('This archived item is no longer available.');
        const item = archive.data();
        if (item.sourceCollection !== collectionName || !item.sourceId || !item.record) {
            throw new Error('The archived item is incomplete or has an invalid type.');
        }

        const batch = db.batch();
        batch.set(db.collection(collectionName).doc(item.sourceId), item.record);
        batch.delete(archiveRef);
        await batch.commit();
    };

    window.loadArchivedContent = async function (collectionName, container) {
        const snapshot = await db.collection('deletedContent').get();
        const items = snapshot.docs
            .map(function (doc) { return { id: doc.id, data: doc.data() }; })
            .filter(function (item) { return item.data.sourceCollection === collectionName; })
            .sort(function (a, b) {
                const aTime = a.data.deletedAt && a.data.deletedAt.toMillis ? a.data.deletedAt.toMillis() : 0;
                const bTime = b.data.deletedAt && b.data.deletedAt.toMillis ? b.data.deletedAt.toMillis() : 0;
                return bTime - aTime;
            });

        container.replaceChildren();
        if (!items.length) {
            const empty = document.createElement('p');
            empty.textContent = 'No recently deleted items.';
            container.appendChild(empty);
            return;
        }

        items.forEach(function (item) {
            const row = document.createElement('div');
            row.className = 'deleted-content-row';
            const title = document.createElement('span');
            title.textContent = item.data.record.title || item.data.record.caption || 'Untitled item';
            const restore = document.createElement('button');
            restore.type = 'button';
            restore.className = 'btn av-btn av-btn--ghost';
            restore.textContent = 'Restore';
            const status = document.createElement('span');
            status.className = 'restore-status';
            status.setAttribute('role', 'status');
            restore.addEventListener('click', async function () {
                restore.disabled = true;
                try {
                    await window.restoreArchivedContent(item.id, collectionName);
                    await window.loadArchivedContent(collectionName, container);
                    window.dispatchEvent(new CustomEvent('site-content-restored', {
                        detail: { collectionName: collectionName }
                    }));
                } catch (error) {
                    console.error('Could not restore archived content:', error);
                    restore.disabled = false;
                    status.textContent = 'Restore failed: ' + error.message;
                }
            });
            row.append(title, restore, status);
            container.appendChild(row);
        });
    };
})();
