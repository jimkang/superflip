include config.mk

HOMEDIR = $(shell pwd)

pushall: sync
	git push origin master

deploy:
	make build && git commit -a -m"Build" && make pushall

prettier:
	prettier --single-quote --write "**/*.html"

build:
	./node_modules/.bin/rollup -c

sync:
	rsync -a public/ $(USER)@$(SERVER):$(APPDIR)

set-up-server-dir:
	ssh $(USER)@$(SERVER) "mkdir -p $(APPDIR)/build"
