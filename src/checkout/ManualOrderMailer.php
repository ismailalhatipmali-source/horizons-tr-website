<?php
declare(strict_types=1);
namespace HorizonsCheckout;

final class ManualOrderMailer {
    public function __construct(private readonly array $config) {}
    private function subject(string $text): string {
        $chunks=[];$part='';
        foreach(preg_split('//u',$text,-1,PREG_SPLIT_NO_EMPTY) as $char){
            if(strlen($part.$char)>45){$chunks[]=$part;$part='';}
            $part.=$char;
        }
        if($part!=='')$chunks[]=$part;
        return implode("\r\n ",array_map(static fn(string $x):string=>'=?UTF-8?B?'.base64_encode($x).'?=',$chunks));
    }
    private function reply($stream,array $allowed):void{
        $count=0;
        do{$line=fgets($stream,2048);if($line===false||++$count>100||!preg_match('/^([0-9]{3})([ -])/',$line,$m))throw new \RuntimeException('MAIL_UNAVAILABLE');}
        while($m[2]==='-');
        if(!in_array((int)$m[1],$allowed,true))throw new \RuntimeException('MAIL_UNAVAILABLE');
    }
    private function sendRaw($stream,string $value):void{while($value!==''){$n=fwrite($stream,$value);if(!$n)throw new \RuntimeException('MAIL_UNAVAILABLE');$value=substr($value,$n);}}
    private function command($stream,string $value,array $expected):void{$this->sendRaw($stream,$value."\r\n");$this->reply($stream,$expected);}
    private function email(string $value):string{
        $value=strtolower(trim($value));
        if(strlen($value)>254||!filter_var($value,FILTER_VALIDATE_EMAIL)||preg_match('/[\r\n]/',$value))throw new \RuntimeException('MAIL_UNAVAILABLE');
        return $value;
    }
    public function send(string $to,string $subject,string $body,?string $replyTo=null):void{
        $c=$this->config;$host=$c['host']??'';$port=(int)($c['port']??0);$mode=$c['security']??'';
        $ehlo=$c['mail_ehlo_domain']??'horizons-tr.com';
        if(!is_string($ehlo)||strlen($ehlo)>253||!str_contains($ehlo,'.')||filter_var($ehlo,FILTER_VALIDATE_DOMAIN,FILTER_FLAG_HOSTNAME)===false)throw new \RuntimeException('MAIL_UNAVAILABLE');
        if(!preg_match('/^[a-zA-Z0-9.-]+$/D',$host)||!in_array($mode,['tls','starttls'],true)||$port<1||$port>65535)throw new \RuntimeException('MAIL_UNAVAILABLE');
        $from=$this->email($c['from']??'');$to=$this->email($to);$replyTo=$replyTo===null?null:$this->email($replyTo);
        if(empty($c['username'])||empty($c['password']))throw new \RuntimeException('MAIL_UNAVAILABLE');
        $context=stream_context_create(['ssl'=>['verify_peer'=>true,'verify_peer_name'=>true,'allow_self_signed'=>false,'peer_name'=>$host,'SNI_enabled'=>true,'crypto_method'=>STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT|STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT]]);
        $stream=@stream_socket_client(($mode==='tls'?'tls':'tcp').'://'.$host.':'.$port,$errno,$errstr,15,STREAM_CLIENT_CONNECT,$context);
        if($stream===false)throw new \RuntimeException('MAIL_UNAVAILABLE');
        stream_set_timeout($stream,15);
        try{
            $this->reply($stream,[220]);$this->command($stream,'EHLO '.$ehlo,[250]);
            if($mode==='starttls'){$this->command($stream,'STARTTLS',[220]);if(stream_socket_enable_crypto($stream,true,STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT|STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT)!==true)throw new \RuntimeException('MAIL_UNAVAILABLE');$this->command($stream,'EHLO '.$ehlo,[250]);}
            $this->command($stream,'AUTH LOGIN',[334]);$this->command($stream,base64_encode($c['username']),[334]);$this->command($stream,base64_encode($c['password']),[235]);
            $this->command($stream,'MAIL FROM:<'.$from.'>',[250]);$this->command($stream,'RCPT TO:<'.$to.'>',[250,251]);$this->command($stream,'DATA',[354]);
            $headers='From: HORIZONS <'.$from.">\r\nTo: <".$to.">\r\n";
            if($replyTo!==null)$headers.='Reply-To: <'.$replyTo.">\r\n";
            $headers.='Subject: '.$this->subject($subject)."\r\nDate: ".gmdate('D, d M Y H:i:s')." +0000\r\nMessage-ID: <".bin2hex(random_bytes(16))."@horizons-tr.com>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n";
            $this->sendRaw($stream,$headers.chunk_split(base64_encode($body),76,"\r\n").".\r\n");$this->reply($stream,[250]);@fwrite($stream,"QUIT\r\n");
        }finally{fclose($stream);}
    }
}
