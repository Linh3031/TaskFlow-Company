import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '../../../lib/firebase.js';
import { getCurrentTimeShort } from '../../../lib/utils.js';

export function compressImage(file, maxEdge = 800, quality = 0.5, stampText = '') {
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
                if (stampText) {
                    // In thời gian chụp + người chụp lên góc dưới ảnh
                    const fontSize = Math.max(14, Math.round(width / 32));
                    const pad = Math.round(fontSize / 2);
                    ctx.font = `bold ${fontSize}px sans-serif`;
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
                    ctx.fillRect(0, height - fontSize - pad * 2, width, fontSize + pad * 2);
                    ctx.fillStyle = '#FFFFFF';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(stampText, pad, height - pad, width - pad * 2);
                }
                canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

export async function processAndUploadImages(filesToProcess, activeStoreId, dateStr, itemId, checklistData, currentUserUsername, activeRecordId, lateUsernames = []) {
    // 1. Nén và Tải ảnh lên Storage
    // Ảnh chụp từ camera trong app có dạng { blob, capturedAt }; ảnh admin tải từ máy là File
    const uploadPromises = filesToProcess.map(async (entry) => {
        const source = entry.blob || entry;
        const capturedAt = entry.capturedAt || null;
        const stampText = capturedAt ? `${capturedAt.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hour12: false })} · ${currentUserUsername}` : '';
        const compressedBlob = await compressImage(source, 800, 0.5, stampText);
        const fileName = `8nttt_${activeStoreId}_${dateStr}_${itemId}_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const imageRef = ref(storage, `8nttt_images/${activeStoreId}/${dateStr}/${fileName}`);
        const uploadResult = await uploadBytes(imageRef, compressedBlob);
        const url = await getDownloadURL(imageRef);
        // uploadedAt lấy giờ server của Storage để đối chiếu với giờ máy lúc chụp
        return { url, time: { capturedAt: capturedAt ? capturedAt.toISOString() : null, uploadedAt: uploadResult?.metadata?.timeCreated || null, by: currentUserUsername } };
    });
    const uploadedResults = await Promise.all(uploadPromises);
    const newUploadedUrls = uploadedResults.map(r => r.url);
    const newImageTimes = uploadedResults.map(r => r.time);
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
                // Căn imageTimes theo đúng vị trí imageUrls (ảnh cũ chưa có thông tin giờ thì để null)
                const oldTimes = i.imageTimes || [];
                const mergedTimes = [...(i.imageUrls || []).map((_, idx) => oldTimes[idx] || null), ...newImageTimes];
                const isNowCompleted = mergedUrls.length >= 4;
                // Lưu lại người đã trễ để tag "Đã trễ" + thống kê vẫn tính sau khi hoàn tất
                const mergedLate = Array.from(new Set([...(i.lateAssignees || []), ...(lateUsernames || [])]));
                return { 
                    ...i, 
                    imageUrls: mergedUrls, 
                    uploaders: mergedUploaders, 
                    imageTimes: mergedTimes, 
                    lateAssignees: mergedLate, 
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