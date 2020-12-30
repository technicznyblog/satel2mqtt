// Class for decoding Satel frames. More: https://blog-techniczny.pl

// CLASS -------------------------

function SatFrame()
{
  this.param=new Array();
  this.frame=null;
}

var p = SatFrame.prototype;

// METHODS -----------------------

// dodaje kolejny bajt do ramki (bajty danych, nie kontrolne)
p.addParam = function(ch)
{
  this.param.push(ch);
}

// zwraca ramkę jako tablicę
p.getFrame = function()
{
  this.makeFrame();
  return this.frame;
}

// zwraca ramkę jako bufor
p.getFrameAsBuffer = function()
{
  this.makeFrame();
  var buf=new Buffer(this.frame, 'binary');
  return(buf);
}

// wpisuje całą ramkę jako tablicę (do użycia w celu sprawdzenia crc)
p.setFrame = function(fr)
{
  this.frame=fr.slice(0);
}

// sprawdza czy zgadza się CRC pełnej, gotowej ramki
p.checkCrc = function()
{
  var crcbegin=this.frame.length-4;
  if( this.frame[crcbegin]==0xfe ) crcbegin--;
  if( this.frame[crcbegin-1]==0xfe ) crcbegin--;
  var params=this.frame.slice(2, crcbegin);
  var crc=this.frame.slice(crcbegin);
  var calculatedcrc=crc16(params);

  if( (calculatedcrc>>8&0xff)!=crc[0] ) return(false);
  if( crc[0]!=0xfe && (calculatedcrc&0xff)!=crc[1] ) return(false);
    else if( crc[0]==0xfe && (calculatedcrc&0xff)!=crc[2] ) return(false);
  return(true);
}

function rl(x)
{
  return ((x<<1) | (x>>15)) & 0xFFFF;
}

// kalkuluje crc przy założeniu, że 0xfef0 ma być traktowane jako 0xfe
function crc16(param)
{
  var crc=0x147a;
  for(w=0; w<param.length; w++)
  {
    crc=rl(crc);
    crc=crc ^ 0xffff & 0xffff;
    crc=(crc+(crc>>8 & 0xff)+param[w]) & 0xffff;
    if( param[w]==0xfe && param[w+1]==0xf0 ) w++;
  }
  return(crc);
}


// tworzy ramkę łącznie z crc i zamianą 0xfe na 0xfef0
p.makeFrame = function()
{
  this.frame=new Array();
  this.frame.push(0xfe);
  this.frame.push(0xfe);
  for( w=0; w<this.param.length; w++ )
  {
    this.frame.push(this.param[w]);
    if( this.param[w]==0xfe ) this.frame.push( 0xf0 );
  }
  var crc=crc16(this.param);
  this.frame.push((crc>>8) & 0xff);
  if( ((crc>>8) & 0xff)==0xfe ) this.frame.push( 0xf0 );
  this.frame.push(crc & 0xff);
  if( (crc & 0xff)==0xfe ) this.frame.push( 0xf0 );
  this.frame.push(0xfe);
  this.frame.push(0x0d);

}


// EXPORTS -----------------------

exports.SatFrame = SatFrame;
