/**
 * @fileoverview perfuse JavaScript.
 *
 * Initializes UI, starts and stops distributed performance tests,
 * and shows real-time results of running performance tests.
 */

var WS_PORT = '8080';
var IP_ADDR = location.host.split(':')[0];

function MyCntrl($scope) {
    $scope.tests = [
        {
            name:'random', 
            cmd:'random', 
            interval: '3',
            regexp: '',
            label: '',
        },
        {
            name:'randread', 
            cmd:'fio --name=foo --rw=randread --size=10m --blocksize=4k --iodepth=64 --direct=1 --directory=/tmp/fio-test', 
            interval: '4',
            regexp: '  read :.* iops=(.*) ,',
            label: 'IOPs',
        },
        {
            name:'randwrite', 
            cmd:'fio --name=foo --rw=randwrite --size=10m --blocksize=4k --iodepth=64 --direct=1 --directory=/tmp/fio-test', 
            interval: '3',
            regexp: 'write:.* iops=(.*) ,',
            label: 'IOPs',
        },
        {
            name:'seqread', 
            cmd:'fio --name=foo --rw=read --size=300m --blocksize=1m --iodepth=16 --direct=1 --directory=/tmp/fio-test', 
            interval: '9',
            regexp: ' READ:.* aggrb=(.*)KB\/s, minb=',
            label: 'KB/s',
        },
        {
            name:'network', 
            cmd:'iperf -c perfuse-%d -t 2 -f m', 
            interval: '3',
            regexp: '\\s+([\\d\\.]+)\\s+Mbits\\/s',
            label: 'MBits/s',
        },
    ];
    $scope.test = $scope.tests[0];

    $scope.start_test = function () {
        var name = $scope.test.name;
        var cmd = $scope.test.cmd;
        var interval = $scope.test.interval;
        var regexp = $scope.test.regexp;
        var label = $scope.test.label;
        Perfuse.perfToggle(name, cmd, interval, regexp, label);
    };
}

/**
 * Perfuse class.
 * @constructor
 */
var Perfuse = function() { };
var Perf_state = false;
var Master = 'perfuse-master';
var Web_sock = null;
var Repeating_tests = null;
var Req_count = 0;
var Data = [];
var Active = {};
var Max_host = 0;
var Reset_bars = false;

Perfuse.perfToggle = function (type, cmd, interval, regexp, label) {
    var id = 'perf-graph';
    if (Perf_state) {
        clearInterval(Repeating_tests);
        //del_bar_chart();
        document.getElementById(id).style.display = 'none';
        Perf_state = false;
        Web_sock.close();
        Req_count = 0;
        document.getElementById('start-test-button').innerHTML = 'Start Test';
    } else { 
        document.getElementById(id).style.display = 'block';
        Data = [];
        Reset_bars = true;
        //gen_bar_chart(label);
        Perf_state = true;
        if (('WebSocket' in window) && IP_ADDR) {
            var url = 'ws://' + IP_ADDR + ':' + WS_PORT + '/';
            Web_sock = new WebSocket(url);
            Web_sock.onmessage = function(event) {
                var res = JSON.parse(event.data);
                if (res.type == 'perf') {
                    var host_num = res.host - 1;
                    var index = null;
                    var new_val = parseInt(res.host, 10);
 
                    if (res.host in Active) {
                        index = Active[res.host];
                    } else {
                        index = 0;
                        for (i in Data) {
                            var old_val = parseInt(Data[i].host, 10);
                            if (old_val > new_val) {
                                break;
                            }
                            index++;
                        }
                        Data.splice(index, 0, {});
                        Reset_bars = true;
                    }
                    Data[index] = { 
                                      host: res.host, 
                                      value: parseFloat(res.value, 10) 
                                  };
                    for (i in Data) {
                        Active[Data[i].host] = i;
                    }
                    if (Req_count >= 0) {
                        //redraw_bars(Data, Reset_bars, Req_count);
                        Reset_bars = false;
                    }
                }
            }
            Web_sock.onopen = function() {
                var req = {};
                req.type = type;
                req.cmd = cmd;
                req.regexp = regexp;
                var req_str = JSON.stringify(req);
                Web_sock.send(req_str);
                Repeating_tests = setInterval(function() {
                    Req_count++;
                    Web_sock.send(req_str);
                }, interval * 1000);
            }
        }
        document.getElementById('start-test-button').innerHTML = 'Stop Test';
    }
}
