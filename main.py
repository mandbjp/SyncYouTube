#!/usr/bin/env python
# -*- coding: utf-8 -*-

import tornado.httpserver
import tornado.ioloop
import tornado.options
import tornado.web
import tornado.websocket
from tornado.options import define, options

import json
import os.path
from datetime import datetime

import threading
import time

define("port", default=8888, help="run on the given port", type=int)


cone = []
cone_id = 0


class MainHandler(tornado.web.RequestHandler):
    def get(self):
        self.render("index.html")


class SocketHandler(tornado.websocket.WebSocketHandler):
    def __init__(self, application, request, **kwargs):
        tornado.websocket.WebSocketHandler.__init__(self, application, request, **kwargs)
        global cone_id
        self.cone_id = cone_id
        cone_id += 1
        self.last_status = None
        self.last_update = datetime.now()

    def open(self):
        if self not in cone:
            cone.append(self)
        print "-------------------"
        print "connected"
        print cone
        print "--------------------"

    def on_close(self):
        if self in cone:
            cone.remove(self)
        print "------------------"
        print "dis-connected"
        print cone
        print "-------------------"

    def on_message(self, message):
        js = json.loads(message)
        # print '[WS]command: ' + js['command']
        print self.cone_id, message

        if js['command'] == 'PING':
            ret = {'command': 'PONG'}
            self.write_message(json.dumps(ret))
            return

        if js['command'] == "PLAYER_STATUS":
            self.last_status = js['payload']
            self.last_update = datetime.now()

            # for c in cone:
            #     ret = {
            #         'command': 'SYNC',
            #         'payload': js['payload']
            #     }
            #     c.write_message(json.dumps(ret))
            return

        if js['command'] in ["SEEK", "PAUSE", "PLAY", "VIDEO_CHANGE"]:
            for c in cone:
                if not c.is_ready() or c is self:
                    continue
                c.write_message(message)
            return

        print "unhandled command", js['command']

    def is_ready(self):
        if self.last_status is None:
            return False

        return True

    def delay_seconds(self, dt=None):
        if dt is None:
            dt = datetime.now()
        return (dt - self.last_update).total_seconds()

    def get_status(self):
        pass

stop_thread = False
def timer_thread():
    while not stop_thread:
        time.sleep(1)

        now = datetime.now()
        currentTimes = [c.last_status['currentTime'] + c.delay_seconds(now) for c in cone if c.is_ready()]
        currentTimes.sort()
        # for c in cone:
        #     delay = (now - c.last_update).total_seconds()
        #     print c.cone_id, delay, c.last_status
        if len(currentTimes) == 0:
            continue
        print currentTimes

        for c in cone:
            if not c.is_ready():
                continue

            if abs(c.last_status['currentTime'] + c.delay_seconds(now) - currentTimes[0]) > 1:
                ret = {
                    'command': 'SEEK',
                    'payload': currentTimes[0]
                }
                c.write_message(json.dumps(ret))


        pass


def main():
    tornado.options.parse_command_line()
    application = tornado.web.Application(
        [
            (r"/", MainHandler),
            (r"/websocket", SocketHandler),

            # to avoid templates
            (r"/img/(.*)", tornado.web.StaticFileHandler, {"path": "./img/"}),
            (r"/static/(.*)", tornado.web.StaticFileHandler, {"path": "./static/"}),
            (r"/robots.txt", tornado.web.StaticFileHandler, {"path": "./robots.txt"}),
        ],
        template_path=os.path.join(os.getcwd(),  "www/templates"),
        static_path=os.path.join(os.getcwd(),  "www/static"),
        debug=True,

    )

    print "server starting at PORT=%d" % options.port

    t = threading.Thread(target=timer_thread)
    t.start()

    http_server = tornado.httpserver.HTTPServer(application)
    http_server.listen(options.port)
    try:
        tornado.ioloop.IOLoop.instance().start()
    except KeyboardInterrupt:
        print "exiting..."
        global stop_thread
        stop_thread = True
        t.join()


if __name__ == "__main__":
    main()
