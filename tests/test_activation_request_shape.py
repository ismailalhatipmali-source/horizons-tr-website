"""Exercise the real PHP HTTP entry with isolated synthetic membership services."""
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BOOTSTRAP = r'''<?php
namespace Horizons;
class ServiceError extends \RuntimeException {
 public function __construct(public string $reason, public int $httpStatus=400) {parent::__construct($reason);}
}
function application($config){return new \stdClass;}
function encoded($value){return json_encode($value,JSON_THROW_ON_ERROR);}
class FixtureSession {
 function session($token){
  if($token!==str_repeat('a',64))throw new ServiceError('AUTH_REQUIRED',401);
  return ['account_id'=>'fixture-account','group_id'=>'fixture-group'];
 }
}
class FixtureMembers {
 function policy($group,$account,$now){
  return ['account_type'=>'institution','learners'=>[],'max_learners'=>500,'can_manage'=>true];
 }
}
function membershipApplication($config){return [new FixtureSession,new FixtureMembers,new \stdClass];}
'''

class RequestShapeTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  if not shutil.which('php'):
   raise RuntimeError('PHP is required; this suite must not silently skip')
  cls.temp=tempfile.TemporaryDirectory()
  base=Path(cls.temp.name)
  public=base/'public';public.mkdir()
  private=base/'private';private.mkdir()
  shutil.copyfile(ROOT/'src/activation/public-index.php',public/'index.php')
  (private/'bootstrap.php').write_text(BOOTSTRAP)
  for name in ['database','vault']:(private/name).touch()
  config=private/'config.php'
  values={ 'database_path':str(private/'database'),'vault_path':str(private/'vault'),
           'code_path':str(private),'url_prefix':'/activation'}
  config.write_text('<?php return '+ 'json_decode('+json.dumps(json.dumps(values))+',true);')
  router=base/'router.php'
  router.write_text("<?php $_SERVER['HTTPS']='on'; require __DIR__.'/public/index.php';")
  with socket.socket() as sock:
   sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  cls.address=f'http://127.0.0.1:{port}'
  env=dict(os.environ,HORIZONS_LICENSE_CONFIG=str(config))
  cls.process=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(public),str(router)],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  try:
   for _ in range(100):
    if cls.process.poll() is not None:raise RuntimeError('Fixture server exited')
    try:
     with socket.create_connection(('127.0.0.1',port),timeout=.1):break
    except OSError:time.sleep(.02)
   else:raise RuntimeError('Fixture server did not start')
  except BaseException:
   cls.tearDownClass();raise

 @classmethod
 def tearDownClass(cls):
  cls.process.terminate();cls.process.wait(timeout=5);cls.temp.cleanup()

 def request(self,body,authorized=False,origin=None,content_type='application/json',method='POST'):
  headers={'Content-Type':content_type}
  if authorized:headers['Authorization']='Bearer '+'a'*64
  if origin:headers['Origin']=origin
  req=urllib.request.Request(self.address+'/activation/v1/member/list',data=body.encode() if method=='POST' else None,headers=headers,method=method)
  try:
   with urllib.request.urlopen(req,timeout=5) as response:return response.status,json.load(response)
  except urllib.error.HTTPError as error:return error.code,json.load(error)

 def test_empty_object_returns_authenticated_roster(self):
  status,result=self.request('{}',True)
  self.assertEqual(status,200);self.assertTrue(result['ok']);self.assertEqual(result['learners'],[])
  self.assertEqual(result['max_learners'],500)

 def test_whitespace_and_nonempty_objects(self):
  for body in [' \n\t{}\r\n','{"unused":true}','{"0":"object-key"}']:
   with self.subTest(body=body):self.assertEqual(self.request(body,True)[0],200)

 def test_empty_object_still_requires_authentication(self):
  self.assertEqual(self.request('{}'),(401,{'ok':False,'error':'AUTH_REQUIRED'}))

 def test_arrays_and_scalars_remain_invalid(self):
  for body in ['[]','[{}]','null','true','0','"text"']:
   with self.subTest(body=body):self.assertEqual(self.request(body,True),(400,{'ok':False,'error':'INVALID_REQUEST'}))

 def test_cross_origin_remains_forbidden(self):
  self.assertEqual(self.request('{}',True,origin='https://other.invalid'),(403,{'ok':False,'error':'FORBIDDEN'}))

 def test_content_type_guard(self):
  self.assertEqual(self.request('{}',True,content_type='text/plain')[0],415)

 def test_get_guard(self):
  self.assertEqual(self.request('',True,method='GET')[0],405)

if __name__=='__main__':unittest.main()

