//! Tes Touch Bar (Fase 3): bar uji sementara lewat API publik AppKit.
//!
//! - Hanya `NSTouchBar`, `NSCustomTouchBarItem`, dan `NSButton` (API publik). Tanpa
//!   framework privat (DFRFoundation), tanpa izin Aksesibilitas/Input Monitoring, dan
//!   tanpa mengubah pengaturan sistem.
//! - Bar dipasang di jendela utama **dan** WKWebView-nya. WKWebView biasanya menjadi
//!   first responder, dan bar milik WebKit bisa menutupi bar jendela. Saat tes berhenti,
//!   bar sebelumnya dikembalikan (hanya bila bar uji masih terpasang di sana).
//! - Hanya selama overlay tes terbuka: frontend memanggil `touchbar_test_stop` saat
//!   selesai, batal, unmount, atau `pagehide`. Penjaga waktu melepas bar setelah
//!   [`MAX_SESSION_SECS`] bila perintah berhenti tidak pernah datang.
//! - Setiap ketukan dikirim sebagai event [`TAP_EVENT`] `{ session, index, segments }` ke
//!   jendela utama. Log hanya berisi siklus hidup dan nomor segmen, tanpa data pribadi.
//! - Bagian Objective-C sengaja kecil dan tidak bisa dites tanpa layar; fungsi murni
//!   (jumlah segmen, identifier, lebar, payload) dites di bawah.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc;
use std::time::Duration;

use serde::Serialize;

use crate::media_window::MAIN_WINDOW_LABEL;

/// Nama event ketukan segmen (frontend: `api.onTouchBarTap`).
pub const TAP_EVENT: &str = "touchbar-tap";
pub const MIN_SEGMENTS: u8 = 4;
pub const MAX_SEGMENTS: u8 = 8;
/// Lebar total tombol uji termasuk jarak antar-item (pt). Wilayah aplikasi Touch Bar
/// ±685 pt saat Control Strip diciutkan; item yang tidak muat disembunyikan AppKit,
/// jadi dibuat konservatif agar semua segmen tampil.
pub const BAR_SPAN_PT: f64 = 600.0;
/// Perkiraan jarak antar-item Touch Bar (pt).
pub const ITEM_GAP_PT: f64 = 8.0;
/// Batas umur satu sesi bila frontend tidak pernah memanggil berhenti.
pub const MAX_SESSION_SECS: u64 = 600;
/// Jumlah warna latar tombol yang berbeda (lihat `native::palette`).
pub const PALETTE_LEN: usize = 8;
const _: () = assert!(MAX_SEGMENTS as usize <= PALETTE_LEN);

const MAIN_THREAD_TIMEOUT: Duration = Duration::from_secs(5);
const IDENTIFIER_PREFIX: &str = "com.ezraanugrah.laptophealthcheck.touchbar.segment.";

static NEXT_SESSION: AtomicU64 = AtomicU64::new(1);

/// Jumlah segmen yang aman (semua muat di wilayah aplikasi Touch Bar).
pub fn clamp_segments(requested: u8) -> u8 {
    requested.clamp(MIN_SEGMENTS, MAX_SEGMENTS)
}

/// Identifier item Touch Bar (unik per segmen, stabil antar-sesi).
pub fn item_identifier(index: u8) -> String {
    format!("{IDENTIFIER_PREFIX}{index}")
}

/// Judul tombol: nomor segmen mulai dari 1 (tidak diterjemahkan).
pub fn segment_title(index: u8) -> String {
    (u16::from(index) + 1).to_string()
}

/// Lebar satu tombol (pt) agar semua segmen membentang di [`BAR_SPAN_PT`].
pub fn segment_width(segments: u8) -> f64 {
    let n = f64::from(clamp_segments(segments));
    ((BAR_SPAN_PT - ITEM_GAP_PT * (n - 1.0)) / n).floor()
}

/// Indeks segmen dari `tag` tombol; `None` bila di luar rentang sesi.
pub fn index_from_tag(tag: isize, segments: u8) -> Option<u8> {
    u8::try_from(tag).ok().filter(|index| *index < segments)
}

/// Payload event [`TAP_EVENT`]. `index` mulai dari 0.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TapEvent {
    pub session: u64,
    pub index: u8,
    pub segments: u8,
}

/// Hasil `touchbar_test_start`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub session: u64,
    pub segments: u8,
    /// Bar uji terpasang di NSWindow utama.
    pub window_installed: bool,
    /// Bar uji terpasang di WKWebView utama.
    pub webview_installed: bool,
}

/// Hasil `touchbar_test_status` (untuk verifikasi; tidak mengubah hasil tes).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TouchBarStatus {
    pub active: bool,
    pub session: Option<u64>,
    pub segments: u8,
    /// `NSTouchBar.isVisible` menurut macOS; `None` bila tidak ada sesi.
    pub visible: Option<bool>,
    pub taps: u32,
    /// Bar uji masih terpasang (belum diganti, mis. oleh WebKit).
    pub window_installed: bool,
    pub webview_installed: bool,
}

fn ensure_main(label: &str) -> Result<(), String> {
    if label == MAIN_WINDOW_LABEL {
        Ok(())
    } else {
        Err("Tes Touch Bar hanya dari jendela utama.".into())
    }
}

fn yes_no(value: bool) -> &'static str {
    if value { "ya" } else { "tidak" }
}

async fn wait_main<T: Send + 'static>(rx: mpsc::Receiver<T>) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || rx.recv_timeout(MAIN_THREAD_TIMEOUT))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|_| "Main thread tidak merespons (Touch Bar).".to_string())
}

/// Pasang bar uji berisi `segments` tombol (dibatasi [`MIN_SEGMENTS`]..=[`MAX_SEGMENTS`]).
/// Sesi lama (bila ada) dilepas lebih dulu.
#[tauri::command]
pub async fn touchbar_test_start(
    app: tauri::AppHandle,
    webview: tauri::Webview,
    segments: u8,
) -> Result<SessionInfo, String> {
    ensure_main(webview.label())?;
    let segments = clamp_segments(segments);
    let session = NEXT_SESSION.fetch_add(1, Ordering::Relaxed);
    let (tx, rx) = mpsc::channel();
    let handle = app.clone();
    // Closure `with_webview` berjalan di main thread (event loop) dengan pointer
    // NSWindow + WKWebView yang valid selama closure.
    webview
        .with_webview(move |platform| {
            let _ = tx.send(native::start(&handle, &platform, session, segments));
        })
        .map_err(|e| e.to_string())?;
    let result = wait_main(rx).await.and_then(|r| r);
    match &result {
        Ok(_) => spawn_watchdog(app, session),
        Err(e) => eprintln!("[touchbar] bar uji gagal dipasang: {e}"),
    }
    result
}

/// Lepas bar uji dan kembalikan bar sebelumnya. `session` = hanya sesi itu (sesi lain
/// dibiarkan); `None` = sesi apa pun. Hasil `true` bila ada sesi yang dilepas.
#[tauri::command]
pub async fn touchbar_test_stop(
    app: tauri::AppHandle,
    session: Option<u64>,
) -> Result<bool, String> {
    let (tx, rx) = mpsc::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(native::stop(session, "diminta frontend"));
    })
    .map_err(|e| e.to_string())?;
    wait_main(rx).await
}

/// Status sesi untuk verifikasi (mis. apakah macOS melaporkan bar uji tampil).
#[tauri::command]
pub async fn touchbar_test_status(app: tauri::AppHandle) -> Result<TouchBarStatus, String> {
    let (tx, rx) = mpsc::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(native::status());
    })
    .map_err(|e| e.to_string())?;
    let status = wait_main(rx).await?;
    if let Some(id) = status.session {
        eprintln!(
            "[touchbar] status sesi {id}: tampil menurut macOS = {}, ketukan = {}, terpasang di jendela = {}, webview = {}",
            yes_no(status.visible == Some(true)),
            status.taps,
            yes_no(status.window_installed),
            yes_no(status.webview_installed),
        );
    } else {
        eprintln!("[touchbar] status: tidak ada sesi aktif");
    }
    Ok(status)
}

/// Penjaga: bar uji tidak pernah tertinggal lebih dari [`MAX_SESSION_SECS`].
fn spawn_watchdog(app: tauri::AppHandle, session: u64) {
    let spawned = std::thread::Builder::new()
        .name("touchbar-watchdog".into())
        .spawn(move || {
            std::thread::sleep(Duration::from_secs(MAX_SESSION_SECS));
            let _ = app.run_on_main_thread(move || {
                native::stop(Some(session), "batas waktu sesi habis");
            });
        });
    if spawned.is_err() {
        eprintln!("[touchbar] penjaga waktu gagal dibuat; bar dilepas saat tes ditutup");
    }
}

#[cfg(target_os = "macos")]
mod native {
    use std::cell::{Cell, RefCell};
    use std::ffi::c_void;

    use objc2::rc::Retained;
    use objc2::runtime::{AnyObject, NSObject, NSObjectProtocol};
    use objc2::{
        DefinedClass, DowncastTarget, MainThreadMarker, MainThreadOnly, Message, define_class,
        msg_send, sel,
    };
    use objc2_app_kit::{
        NSButton, NSColor, NSControl, NSCustomTouchBarItem, NSResponder, NSTouchBar,
        NSTouchBarItem, NSView, NSWindow,
    };
    use objc2_foundation::{NSArray, NSSet, NSString};
    use tauri::webview::PlatformWebview;
    use tauri::{AppHandle, Emitter};

    use super::{
        MAIN_WINDOW_LABEL, PALETTE_LEN, SessionInfo, TAP_EVENT, TapEvent, TouchBarStatus,
        index_from_tag, item_identifier, segment_title, segment_width, yes_no,
    };

    struct TargetIvars {
        app: AppHandle,
        session: u64,
        segments: u8,
        taps: Cell<u32>,
    }

    define_class!(
        // SAFETY:
        // - NSObject tidak punya syarat subclass.
        // - `TapTarget` tidak mengimplementasikan `Drop`.
        #[unsafe(super(NSObject))]
        #[thread_kind = MainThreadOnly]
        #[ivars = TargetIvars]
        struct TapTarget;

        impl TapTarget {
            // SAFETY: tanda tangan aksi NSControl standar `- (void)segmentTapped:(id)sender`.
            #[unsafe(method(segmentTapped:))]
            fn segment_tapped(&self, sender: Option<&AnyObject>) {
                self.handle_tap(sender);
            }
        }

        // SAFETY: NSObjectProtocol tidak punya syarat keamanan.
        unsafe impl NSObjectProtocol for TapTarget {}
    );

    impl TapTarget {
        fn new(mtm: MainThreadMarker, ivars: TargetIvars) -> Retained<Self> {
            let this = Self::alloc(mtm).set_ivars(ivars);
            // SAFETY: tanda tangan `init` milik NSObject benar.
            unsafe { msg_send![super(this), init] }
        }

        /// Dipanggil AppKit di main thread. Tidak boleh panik (FFI).
        fn handle_tap(&self, sender: Option<&AnyObject>) {
            let ivars = self.ivars();
            let Some(control) = sender.and_then(|s| s.downcast_ref::<NSControl>()) else {
                return;
            };
            let Some(index) = index_from_tag(control.tag(), ivars.segments) else {
                return;
            };
            ivars.taps.set(ivars.taps.get().saturating_add(1));
            eprintln!(
                "[touchbar] ketukan segmen {} dari {} (sesi {})",
                segment_title(index),
                ivars.segments,
                ivars.session
            );
            let payload = TapEvent {
                session: ivars.session,
                index,
                segments: ivars.segments,
            };
            if let Err(e) = ivars.app.emit_to(MAIN_WINDOW_LABEL, TAP_EVENT, payload) {
                eprintln!("[touchbar] event ketukan gagal dikirim: {e}");
            }
        }
    }

    /// Responder (NSWindow/WKWebView) yang bar-nya diganti, beserta bar sebelumnya.
    struct Installed {
        responder: Retained<NSResponder>,
        previous: Option<Retained<NSTouchBar>>,
    }

    struct Session {
        id: u64,
        segments: u8,
        bar: Retained<NSTouchBar>,
        // Referensi kuat selama sesi: target tombol NSControl tidak di-retain AppKit.
        target: Retained<TapTarget>,
        buttons: Vec<Retained<NSButton>>,
        _items: Vec<Retained<NSCustomTouchBarItem>>,
        window: Option<Installed>,
        webview: Option<Installed>,
    }

    thread_local! {
        // Hanya disentuh di main thread (objek AppKit bukan `Send`).
        static SESSION: RefCell<Option<Session>> = const { RefCell::new(None) };
    }

    fn palette() -> [Retained<NSColor>; PALETTE_LEN] {
        [
            NSColor::systemRedColor(),
            NSColor::systemOrangeColor(),
            NSColor::systemGreenColor(),
            NSColor::systemTealColor(),
            NSColor::systemBlueColor(),
            NSColor::systemPurpleColor(),
            NSColor::systemPinkColor(),
            NSColor::systemBrownColor(),
        ]
    }

    /// Objek Objective-C dari pointer Tauri, hanya bila kelasnya cocok.
    fn retained_from<T: DowncastTarget + Message>(ptr: *mut c_void) -> Option<Retained<T>> {
        if ptr.is_null() {
            return None;
        }
        // SAFETY: Tauri memberi pointer objek Objective-C yang hidup selama closure
        // `with_webview`; kelasnya diperiksa dulu sebelum dipakai sebagai `T`.
        let object: &AnyObject = unsafe { &*ptr.cast::<AnyObject>() };
        object.downcast_ref::<T>().map(Message::retain)
    }

    /// Lebar tetap tombol (Auto Layout, API publik NSView/NSLayoutDimension).
    fn set_width(view: &NSView, width: f64) {
        // SAFETY: `translatesAutoresizingMaskIntoConstraints` (BOOL), `widthAnchor`
        // (NSLayoutDimension), `constraintEqualToConstant:` (CGFloat = f64 di 64-bit),
        // dan `setActive:` (BOOL) adalah API publik AppKit sejak macOS 10.11.
        unsafe {
            let _: () = msg_send![view, setTranslatesAutoresizingMaskIntoConstraints: false];
            let anchor: Retained<AnyObject> = msg_send![view, widthAnchor];
            let constraint: Retained<AnyObject> =
                msg_send![&*anchor, constraintEqualToConstant: width];
            let _: () = msg_send![&*constraint, setActive: true];
        }
    }

    struct Built {
        bar: Retained<NSTouchBar>,
        items: Vec<Retained<NSCustomTouchBarItem>>,
        buttons: Vec<Retained<NSButton>>,
    }

    /// Bar berisi `segments` tombol bernomor dengan warna berbeda dan lebar tetap.
    /// AppKit tidak me-retain target tombol: pemanggil wajib menjaga `target` tetap hidup.
    fn build_bar(mtm: MainThreadMarker, target: &TapTarget, segments: u8) -> Built {
        let target_object: &AnyObject = target;
        let action = sel!(segmentTapped:);
        let colors = palette();
        let width = segment_width(segments);
        let mut identifiers = Vec::with_capacity(usize::from(segments));
        let mut items = Vec::with_capacity(usize::from(segments));
        let mut buttons = Vec::with_capacity(usize::from(segments));
        for index in 0..segments {
            let title = NSString::from_str(&segment_title(index));
            // SAFETY: `target` hidup selama sesi (disimpan di `Session`) dan menanggapi
            // `segmentTapped:`; target dikosongkan sebelum dilepas (lihat `stop`).
            let button = unsafe {
                NSButton::buttonWithTitle_target_action(
                    &title,
                    Some(target_object),
                    Some(action),
                    mtm,
                )
            };
            button.setTag(isize::from(index));
            button.setBezelColor(Some(&colors[usize::from(index) % PALETTE_LEN]));
            set_width(&button, width);

            let identifier = NSString::from_str(&item_identifier(index));
            let item = NSCustomTouchBarItem::initWithIdentifier(
                NSCustomTouchBarItem::alloc(mtm),
                &identifier,
            );
            item.setView(&button);
            identifiers.push(identifier);
            items.push(item);
            buttons.push(button);
        }

        let bar = NSTouchBar::new(mtm);
        bar.setDefaultItemIdentifiers(&NSArray::from_retained_slice(&identifiers));
        let template: Vec<&NSTouchBarItem> = items.iter().map(|item| &***item).collect();
        bar.setTemplateItems(&NSSet::from_slice(&template));
        Built {
            bar,
            items,
            buttons,
        }
    }

    fn install(responder: Retained<NSResponder>, bar: &NSTouchBar) -> Installed {
        let previous = responder.touchBar();
        responder.setTouchBar(Some(bar));
        Installed {
            responder,
            previous,
        }
    }

    fn is_ours(installed: Option<&Installed>, bar: &NSTouchBar) -> bool {
        installed.is_some_and(|i| {
            i.responder
                .touchBar()
                .is_some_and(|current| std::ptr::eq(&*current, bar))
        })
    }

    /// Kembalikan bar sebelumnya hanya bila bar uji masih terpasang; bila sudah diganti
    /// pihak lain (mis. WebKit saat mengedit teks), biarkan.
    fn restore(installed: Option<Installed>, bar: &NSTouchBar) -> &'static str {
        match installed {
            None => "tidak dipasang",
            Some(i) if is_ours(Some(&i), bar) => {
                i.responder.setTouchBar(i.previous.as_deref());
                "dikembalikan"
            }
            Some(_) => "sudah diganti pihak lain",
        }
    }

    pub fn start(
        app: &AppHandle,
        platform: &PlatformWebview,
        session: u64,
        segments: u8,
    ) -> Result<SessionInfo, String> {
        let mtm = MainThreadMarker::new()
            .ok_or_else(|| "Touch Bar hanya bisa diatur dari main thread.".to_string())?;
        stop(None, "diganti sesi baru");

        let window = retained_from::<NSWindow>(platform.ns_window());
        // WKWebView adalah subclass NSView (crate WebKit tidak diperlukan).
        let webview = retained_from::<NSView>(platform.inner());
        if window.is_none() && webview.is_none() {
            return Err("Jendela utama tidak ditemukan untuk Touch Bar.".into());
        }

        let target = TapTarget::new(
            mtm,
            TargetIvars {
                app: app.clone(),
                session,
                segments,
                taps: Cell::new(0),
            },
        );
        let Built {
            bar,
            items,
            buttons,
        } = build_bar(mtm, &target, segments);

        let window = window.map(|w| install(Retained::into_super(w), &bar));
        let webview = webview.map(|v| install(Retained::into_super(v), &bar));
        let info = SessionInfo {
            session,
            segments,
            window_installed: window.is_some(),
            webview_installed: webview.is_some(),
        };
        eprintln!(
            "[touchbar] bar uji dipasang (sesi {session}, {segments} segmen @ {} pt; jendela: {}, webview: {})",
            segment_width(segments),
            yes_no(info.window_installed),
            yes_no(info.webview_installed),
        );
        SESSION.with_borrow_mut(|slot| {
            *slot = Some(Session {
                id: session,
                segments,
                bar,
                target,
                buttons,
                _items: items,
                window,
                webview,
            });
        });
        Ok(info)
    }

    pub fn stop(only: Option<u64>, reason: &str) -> bool {
        // Ambil sesi keluar dulu agar tidak ada pinjaman RefCell saat memanggil AppKit.
        let taken = SESSION.with_borrow_mut(|slot| match (slot.as_ref(), only) {
            (Some(current), Some(id)) if current.id != id => None,
            _ => slot.take(),
        });
        let Some(session) = taken else {
            return false;
        };
        let Session {
            id,
            bar,
            target,
            buttons,
            window,
            webview,
            ..
        } = session;
        let window = restore(window, &bar);
        let webview = restore(webview, &bar);
        // Ketukan yang datang terlambat tidak boleh mengenai target yang sudah dilepas.
        for button in &buttons {
            // SAFETY: mengosongkan target/aksi selalu valid untuk NSControl.
            unsafe {
                button.setTarget(None);
                button.setAction(None);
            }
        }
        eprintln!(
            "[touchbar] bar uji dilepas (sesi {id}, {reason}; {} ketukan; jendela: {window}, webview: {webview})",
            target.ivars().taps.get()
        );
        true
    }

    pub fn status() -> TouchBarStatus {
        SESSION.with_borrow(|slot| match slot {
            None => TouchBarStatus::default(),
            Some(s) => TouchBarStatus {
                active: true,
                session: Some(s.id),
                segments: s.segments,
                visible: Some(s.bar.isVisible()),
                taps: s.target.ivars().taps.get(),
                window_installed: is_ours(s.window.as_ref(), &s.bar),
                webview_installed: is_ours(s.webview.as_ref(), &s.bar),
            },
        })
    }
}

/// Fallback OS lain (bukan target): selalu gagal, tidak pernah panik.
#[cfg(not(target_os = "macos"))]
mod native {
    use super::{SessionInfo, TouchBarStatus};

    pub fn start(
        _app: &tauri::AppHandle,
        _platform: &tauri::webview::PlatformWebview,
        _session: u64,
        _segments: u8,
    ) -> Result<SessionInfo, String> {
        Err("Tes Touch Bar hanya didukung di macOS.".into())
    }

    pub fn stop(_only: Option<u64>, _reason: &str) -> bool {
        false
    }

    pub fn status() -> TouchBarStatus {
        TouchBarStatus::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clamps_segments_to_safe_range() {
        assert_eq!(clamp_segments(0), MIN_SEGMENTS);
        assert_eq!(clamp_segments(MIN_SEGMENTS - 1), MIN_SEGMENTS);
        assert_eq!(clamp_segments(MIN_SEGMENTS), MIN_SEGMENTS);
        assert_eq!(clamp_segments(6), 6);
        assert_eq!(clamp_segments(MAX_SEGMENTS), MAX_SEGMENTS);
        assert_eq!(clamp_segments(MAX_SEGMENTS + 1), MAX_SEGMENTS);
        assert_eq!(clamp_segments(u8::MAX), MAX_SEGMENTS);
    }

    #[test]
    fn identifiers_are_unique_stable_and_ascii() {
        let ids: Vec<String> = (0..MAX_SEGMENTS).map(item_identifier).collect();
        let unique: std::collections::HashSet<&String> = ids.iter().collect();
        assert_eq!(unique.len(), ids.len());
        assert_eq!(
            ids[0],
            "com.ezraanugrah.laptophealthcheck.touchbar.segment.0"
        );
        assert!(ids.iter().all(|id| id.is_ascii() && !id.contains(' ')));
    }

    #[test]
    fn titles_start_at_one() {
        assert_eq!(segment_title(0), "1");
        assert_eq!(segment_title(MAX_SEGMENTS - 1), MAX_SEGMENTS.to_string());
        assert_eq!(segment_title(u8::MAX), "256", "tidak overflow");
    }

    #[test]
    fn segments_fit_the_bar_and_stay_touchable() {
        for n in MIN_SEGMENTS..=MAX_SEGMENTS {
            let width = segment_width(n);
            let total = width * f64::from(n) + ITEM_GAP_PT * f64::from(n - 1);
            assert!(total <= BAR_SPAN_PT, "{n} segmen: {total} pt");
            assert!(width >= 44.0, "{n} segmen terlalu sempit: {width} pt");
        }
        assert_eq!(
            segment_width(0),
            segment_width(MIN_SEGMENTS),
            "jumlah dibatasi"
        );
        assert_eq!(segment_width(8), 68.0);
    }

    #[test]
    fn tag_maps_to_index_only_within_session() {
        assert_eq!(index_from_tag(-1, 8), None);
        assert_eq!(index_from_tag(0, 8), Some(0));
        assert_eq!(index_from_tag(7, 8), Some(7));
        assert_eq!(index_from_tag(8, 8), None);
        assert_eq!(index_from_tag(5, 4), None);
        assert_eq!(index_from_tag(isize::MAX, 8), None);
    }

    #[test]
    fn serializes_camel_case_for_frontend() {
        let tap = serde_json::to_value(TapEvent {
            session: 3,
            index: 2,
            segments: 8,
        })
        .unwrap();
        assert_eq!(
            tap,
            serde_json::json!({ "session": 3, "index": 2, "segments": 8 })
        );

        let info = serde_json::to_value(SessionInfo {
            session: 1,
            segments: 6,
            window_installed: true,
            webview_installed: false,
        })
        .unwrap();
        assert_eq!(
            info,
            serde_json::json!({ "session": 1, "segments": 6, "windowInstalled": true, "webviewInstalled": false })
        );

        let idle = serde_json::to_value(TouchBarStatus::default()).unwrap();
        assert_eq!(
            idle,
            serde_json::json!({
                "active": false,
                "session": null,
                "segments": 0,
                "visible": null,
                "taps": 0,
                "windowInstalled": false,
                "webviewInstalled": false
            })
        );
    }

    #[test]
    fn only_main_window_may_start() {
        assert!(ensure_main(MAIN_WINDOW_LABEL).is_ok());
        assert!(ensure_main("media-test").is_err());
    }

    #[test]
    fn stop_without_session_is_a_no_op() {
        // Di thread test tidak ada sesi; `stop` tidak boleh panik atau mengubah apa pun.
        assert!(!native::stop(None, "test"));
        assert!(!native::stop(Some(42), "test"));
        assert_eq!(native::status(), TouchBarStatus::default());
    }
}
