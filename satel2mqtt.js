// Publish satael outputs information via MQTT broker
// More: https://blog-techniczny.pl

var SatFrameClass = require("./satframe");
var dgram = require('dgram');
var http = require('http');
var child_process = require('child_process');
var dgram = require('dgram');
var mqtt = require('mqtt');
var net = require('net');

var mqttBroker="mqtt://192.168.1.20";
var mqttClientId="satel2mqtt";
var mqttTopic="satel/outputs";
var mqttOptions={clientId: 'satel2mqtt'};
//var mqttOptions={clientId: 'satel2mqtt', username: 'user', password: 'password'};

var satelIP='192.168.1.120';
var numOutputs=128; //128 for Integra 128

var logChanges=true; //log outputs changes to console

var moptions={ //options for publishing
  retain:false,
  qos:0 };

var bufsize=1024;
var buf=new Buffer(bufsize);
var bufpos=0;

var outputs=new Array;
var outputschange=new Array;

var mclient  = mqtt.connect(mqttBroker,mqttOptions);
mclient.on("connect",function(){
    console.log("mqtt connected");
  });
mclient.on("error",function(error){ console.log("mqtt - can't connect "+error); } );

var client = new net.Socket();
client.connect(7094, satelIP, function() {
	console.log('Connected to Satel');
});

client.on('data', function(data) {
	var receivedData = "";

	if(bufpos+data.length>bufsize) bufpos=0;
	for(w=0; w<data.length; w++ )
	{
		buf[bufpos]=data[w];
		bufpos++;
	}
	oldbufpos=bufpos;
	while( (bufpos=parseSatel(buf, bufpos))!=oldbufpos ) oldbufpos=bufpos;
});

client.on('close', function() {
	console.log('Connection closed');
	process.exit(1);
});

client.on("error", function() { console.log("error"); exit(1); });

// query for state of outputs
var sf=new SatFrameClass.SatFrame();
sf.addParam(0x17);

//initiate array for outputs and states
//outputs 1...128 for Integra 128
for( w=1; w<=numOutputs; w++ )
{
  outputs[w]=0;
  outputschange[w]=0;
}

// peridically asking for outputs' states
setInterval( function()
{
  var fr=sf.getFrameAsBuffer();
  client.write(fr);
}, 1000 );

// searching for full frame, watch for buffer overflow
function parseSatel(b, size)
{
  var begin=-1;
  var end=-1;
  var frame=new Array;

  for( w=0; w<size && end==-1; w++ )
  {
    if( b[w]==0xfe && b[w+1]==0xfe ) begin=w;
    if( b[w]==0xfe && b[w+1]==0x0d ) end=w+1;
  }

  if( end!=-1 ) // full frame found
  {

    //rewrite the frame
    q=0;
    for(w=begin; w<=end; w++)
    {
      frame[q]=b[w];
      q++;
    }

    //rewrite the remaining part to the beginning of buffer
    q=0;
    for(w=end+1; w<size; w++)
    {
      b[q]=b[w];
      q++;
    }

    runFrame(frame);
    return(q);

  }

  return(size);

}

// start action related to frame, if required
function runFrame(f)
{

  var tm = new Date();

  var test=new SatFrameClass.SatFrame();
  test.setFrame(f);
  if( !test.checkCrc() )
  {
    console.log("Niepoprawny CRC dla ramki: "+f);
    return;
  }

  if( f[2]==0x17 ) //output
  {
    for( w=0; w<128; w++ )
    {
      out=f[3+Math.floor(w/8)]&(Math.pow(2,(w%8)));
      if( out>0 ) out=1;
      outputschange[w+1]=0;
      if( out!=outputs[w+1] ) {
        outputschange[w+1]=1;
        if(logChanges) console.log(tm+" change "+(w+1)+"="+out);
				if (mclient.connected==true) {
          mclient.publish(mqttTopic, "{\"output\": "+(w+1)+", \"state\": "+out+"}",moptions);
        }
      }
      outputs[w+1]=out;
    }

  }
}
