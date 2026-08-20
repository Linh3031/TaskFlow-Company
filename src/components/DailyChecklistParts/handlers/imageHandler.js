import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '../../../lib/firebase.js';
import { getCurrentTimeShort } from '../../../lib/utils.js';

export function compressImage(file, maxEdge = 800, quality = 0.5) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader(); 
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image(); 
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width; 
                let height = img.height;
                if (width > height) { 
                    if (width > maxEdge) { height = Math.round((height * maxEdge) / width); width = maxEdge; } 
                } else { 
                    if (height > maxEdge) { width = Math.round((width * maxEdge) / height); height = maxEdge; } 
                }
                canvas.width = width; 
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF'; 
                ctx.fillRect(0, 0, width, height); 
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

export async function processAndUploadImages(filesToProcess, activeStoreId, dateStr, itemId, checklistData, currentUserUsername, activeRecordId) {
    // 1. Nén và Tải ảnh lên Storage
    const uploadPromises = filesToProcess.map(async (file) => {
        const compressedBlob = await compressImage(file);
        const fileName = `8nttt_${activeStoreId}_${dateStr}_${itemId}_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const imageRef = ref(storage, `8nttt_images/${activeStoreId}/${dateStr}/${fileName}`);
        await uploadBytes(imageRef, compressedBlob);
        return await getDownloadURL(imageRef);
    });
    const newUploadedUrls = await Promise.all(uploadPromises);
    const newUploaders = newUploadedUrls.map(() => currentUserUsername);

    // 2. Định tuyến DB
    const targetRecordId = activeRecordId || `${activeStoreId}_${dateStr}`;
    const dailyRef = doc(db, '8nttt_daily_records', targetRecordId);
    const yyyyMM = dateStr.substring(0, 7);
    const currentDayNumber = parseInt(dateStr.split('-')[2], 10);
    const monthlyStatsRef = doc(db, '8nttt_monthly_stats', `${activeStoreId}_${yyyyMM}`);
    
    // 3. Ghi dữ liệu đồng thời bằng Transaction
    await runTransaction(db, async (transaction) => {
        const dailyDoc = await transaction.get(dailyRef);
        const monthlyDoc = await transaction.get(monthlyStatsRef);
        
        let serverItems = dailyDoc.exists() ? (dailyDoc.data().items || []) : checklistData;
        const updatedItems = serverItems.map(i => {
            if (i.id === itemId) {
                const mergedUrls = [...(i.imageUrls || []), ...newUploadedUrls];
                const mergedUploaders = [...(i.uploaders || []), ...newUploaders];
                const isNowCompleted = mergedUrls.length >= 4;
                return { 
                    ...i, 
                    imageUrls: mergedUrls, 
                    uploaders: mergedUploaders, 
                    completed: isNowCompleted, 
                    completedBy: isNowCompleted ? currentUserUsername : i.completedBy, 
                    completedAt: isNowCompleted ? getCurrentTimeShort() : i.completedAt 
                };
            }
            return i;
        });

        let monthlyData = monthlyDoc.exists() ? monthlyDoc.data() : { users: {} };
        let usersStats = monthlyData.users || {};
        if (!usersStats[currentUserUsername]) { 
            usersStats[currentUserUsername] = { name: currentUserUsername, total: 0, days: {} }; 
        }
        
        const addedCount = newUploadedUrls.length;
        usersStats[currentUserUsername].total += addedCount;
        usersStats[currentUserUsername].days[currentDayNumber] = (usersStats[currentUserUsername].days[currentDayNumber] || 0) + addedCount;
        
        transaction.set(dailyRef, { items: updatedItems, createdAt: dailyDoc.exists() ? dailyDoc.data().createdAt : serverTimestamp() }, { merge: true });
        transaction.set(monthlyStatsRef, { users: usersStats }, { merge: true });
    });

    return true;
}