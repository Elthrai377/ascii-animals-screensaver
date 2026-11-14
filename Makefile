NAME       := ascii-animals-screensaver
VERSION    := $(shell sed -n 's/^__version__ = "\(.*\)"/\1/p' src/$(NAME))
MAINTAINER ?= Elthrai377 <Elthrai377@users.noreply.github.com>

PREFIX     ?= /usr/local
SYSCONFDIR ?= /etc
DESTDIR    ?=

SHARE      := $(DESTDIR)$(PREFIX)/share
WEB_FILES  := web/index.html web/screensaver.css web/screensaver.js
FONT_FILES := $(wildcard web/fonts/*)
ICON_SIZES := 16 32 48 128

DEB_ROOT   := build/deb
DEB_FILE   := dist/$(NAME)_$(VERSION)_all.deb

.PHONY: all run settings check install uninstall deb clean

all: deb

# ---- development (straight from the checkout, nothing installed) ----------

run:
	./src/$(NAME) show --windowed

settings:
	./src/$(NAME)

check:
	node --check web/screensaver.js
	python3 -m py_compile src/$(NAME)
	desktop-file-validate data/*.desktop 2>/dev/null || true

# ---- install ----------------------------------------------------------------

install:
	install -Dm755 src/$(NAME) $(DESTDIR)$(PREFIX)/bin/$(NAME)
	install -d $(SHARE)/$(NAME)/web/fonts
	install -m644 $(WEB_FILES) $(SHARE)/$(NAME)/web/
	install -m644 $(FONT_FILES) $(SHARE)/$(NAME)/web/fonts/
	install -Dm644 data/$(NAME).desktop $(SHARE)/applications/$(NAME).desktop
	install -Dm644 data/$(NAME)-autostart.desktop $(DESTDIR)$(SYSCONFDIR)/xdg/autostart/$(NAME).desktop
	for s in $(ICON_SIZES); do \
		install -Dm644 data/icons/hicolor/$${s}x$${s}/apps/$(NAME).png \
			$(SHARE)/icons/hicolor/$${s}x$${s}/apps/$(NAME).png; \
	done

uninstall:
	rm -f $(DESTDIR)$(PREFIX)/bin/$(NAME)
	rm -rf $(SHARE)/$(NAME)
	rm -f $(SHARE)/applications/$(NAME).desktop
	rm -f $(DESTDIR)$(SYSCONFDIR)/xdg/autostart/$(NAME).desktop
	for s in $(ICON_SIZES); do rm -f $(SHARE)/icons/hicolor/$${s}x$${s}/apps/$(NAME).png; done

# ---- Debian package ---------------------------------------------------------

deb: check
	rm -rf $(DEB_ROOT)
	$(MAKE) --no-print-directory install DESTDIR=$(DEB_ROOT) PREFIX=/usr SYSCONFDIR=/etc
	install -Dm644 packaging/debian/copyright $(DEB_ROOT)/usr/share/doc/$(NAME)/copyright
	install -d $(DEB_ROOT)/DEBIAN
	sed -e 's/@VERSION@/$(VERSION)/' \
	    -e "s/@SIZE@/$$(du -sk --exclude=DEBIAN $(DEB_ROOT) | cut -f1)/" \
	    -e 's/@MAINTAINER@/$(MAINTAINER)/' \
	    packaging/debian/control > $(DEB_ROOT)/DEBIAN/control
	mkdir -p dist
	dpkg-deb --root-owner-group -Zxz --build $(DEB_ROOT) $(DEB_FILE)
	@echo
	@echo "Built $(DEB_FILE)"
	@echo "Install it with:  sudo apt install ./$(DEB_FILE)"

clean:
	rm -rf build dist
