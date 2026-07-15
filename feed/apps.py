from django.apps import AppConfig


class FeedConfig(AppConfig):
    name = 'feed'

    def ready(self):
        # Register pillow-heif so Pillow can decode HEIC/HEIF end-to-end. This is
        # a global Pillow registration, so it covers BOTH media pipelines that go
        # through feed/media.py — post photos (finalize_photo) and profile
        # avatar/banner (finalize_profile_image). Without it, Pillow 12 has no
        # HEIF decoder at all (confirmed via Image.registered_extensions()).
        #
        # Guarded so a partial environment missing the wheel degrades to
        # "HEIC unsupported" (the prior behavior) rather than crashing startup —
        # consistent with the media pipeline's other soft-dependency guards.
        try:
            from pillow_heif import register_heif_opener
            register_heif_opener()
        except Exception:
            pass
