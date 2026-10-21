<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require dirname(__DIR__).'/dietary-recall.php';
require dirname(__DIR__).'/auth-session.php';
class ApiResponse extends RuntimeException {
    public function __construct(public array $body,public int $status){parent::__construct('Captured response');}
}
function sendJson(array $body,int $status=200):void{throw new ApiResponse($body,$status);}
function sendError(string $message,int $status=400):void{throw new ApiResponse(['error'=>$message],$status);}
function getUserById(PDO $pdo,int $id):array{$s=$pdo->prepare('SELECT * FROM users WHERE id=?');$s->execute([$id]);return $s->fetch(PDO::FETCH_ASSOC)?:throw new RuntimeException('Unknown test user');}
function capture(callable $call,int $status=200):array{
    try{$call();}catch(ApiResponse $r){if($r->status!==$status)throw new RuntimeException('Unexpected status '.$r->status);return $r->body;}
    throw new RuntimeException('Missing response');
}
function invalid(callable $call):void{try{$call();}catch(InvalidArgumentException){return;}throw new RuntimeException('Invalid data accepted');}
$data=['wakeTime'=>'07:00','wakeActivity'=>'','sleepTime'=>'23:00','activityTime'=>'','activityType'=>'','activityDuration'=>'','noActivity'=>true];
$times=['breakfastTime'=>'08:00','snackTime'=>'11:00','lunchTime'=>'14:00','afternoonSnackTime'=>'17:00','dinnerTime'=>'20:00'];
foreach(recallMealFields() as [$type,$time,$place,$details,$skip]){$data[$time]=$times[$time];$data[$place]='En casa';$data[$details]='Alimentos de prueba';$data[$skip]=false;}
validateDietaryRecall($data);
$withoutWakeActivity=$data;unset($withoutWakeActivity['wakeActivity']);validateDietaryRecall($withoutWakeActivity);
foreach(['2000-02-30','1900-02-29','2999-01-01',''] as $date)invalid(fn()=>validateRecallDate($date));
foreach(recallMealFields() as [$type,$time,$place,$details,$skip]){
    $bad=$data;$bad[$skip]=true;invalid(fn()=>validateDietaryRecall($bad));
    $bad=$data;$bad[$time]='24:00';invalid(fn()=>validateDietaryRecall($bad));
    $bad=$data;$bad[$place]='';invalid(fn()=>validateDietaryRecall($bad));
    $bad=$data;$bad[$details]=' ';invalid(fn()=>validateDietaryRecall($bad));
    $ok=$data;$ok[$skip]=true;$ok[$time]=$ok[$place]=$ok[$details]='';validateDietaryRecall($ok);
}
$suggested=suggestedMealSchedule($data);validateMealSchedule($suggested);
if($suggested['breakfastTime']!=='08:00'||$suggested['afternoonSnackTime']!=='17:00')throw new RuntimeException('Observed hours changed');
$missing=$data;$missing['snackTime']=$missing['afternoonSnackTime']='';
validateMealSchedule(suggestedMealSchedule($missing));
$night=$data;$night['wakeTime']='20:00';$night['sleepTime']='12:00';$night['breakfastTime']='21:00';$night['lunchTime']='02:00';$night['dinnerTime']='09:00';
$nightSchedule=suggestedMealSchedule($night);validateMealSchedule($nightSchedule);
if($nightSchedule['lunchTime']!=='02:00')throw new RuntimeException('Night schedule changed');
$bad=$suggested;$bad['lunchTime']='24:00';invalid(fn()=>validateMealSchedule($bad));
$bad=$suggested;$bad['lunchTime']=$bad['breakfastTime'];invalid(fn()=>validateMealSchedule($bad));
$pdo=new PDO('mysql:host=127.0.0.1;dbname=eatwell_db;charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$schemas=[];foreach(['users','dietary_recalls','dietary_recall_meals','meal_schedules'] as $table)$schemas[]=$pdo->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM)[1];
$test='eatwell_initial_check_'.bin2hex(random_bytes(6));$pdo->exec("CREATE DATABASE `$test` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
try{
    $pdo->exec("USE `$test`");foreach($schemas as $schema)$pdo->exec($schema);
    $pdo->exec("INSERT INTO users(id,name,username,email,password_hash) VALUES(91001,'Test','initial_1','initial1@example.invalid','synthetic'),(91002,'Test','initial_2','initial2@example.invalid','synthetic')");
    $_GET=[];$_SERVER['REQUEST_METHOD']='GET';capture(fn()=>handleDietaryRecall($pdo,'recall.initial',[]),401);
    $token=issueAuthToken($pdo,91001);$_SERVER['HTTP_AUTHORIZATION']='Bearer '.$token;
    if(capture(fn()=>handleDietaryRecall($pdo,'recall.initial',[]))['completed'])throw new RuntimeException('Survey already completed');
    if(capture(fn()=>handleMealSchedule($pdo,'schedule.get',[]))['schedule']!==null)throw new RuntimeException('Suggestions without survey');
    $pdo->exec("CREATE TRIGGER fail_schedule BEFORE INSERT ON meal_schedules FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic failure'");
    try{saveDietaryRecall($pdo,91001,'2000-01-01',validateDietaryRecall($data));throw new RuntimeException('Expected failure');}catch(PDOException){}
    if(initialRecallRecord($pdo,91001)!==null||(int)$pdo->query('SELECT COUNT(*) FROM dietary_recall_meals')->fetchColumn()!==0)throw new RuntimeException('Partial initial record');
    $pdo->exec('DROP TRIGGER fail_schedule');$_SERVER['REQUEST_METHOD']='POST';
    $input=['recallDate'=>'2000-01-01','recall'=>$data];
    capture(fn()=>handleDietaryRecall($pdo,'recall.save',['userId'=>91002,...$input]),403);
    capture(fn()=>handleDietaryRecall($pdo,'recall.save',$input));
    if((int)$pdo->query('SELECT COUNT(*) FROM dietary_recall_meals')->fetchColumn()!==5)throw new RuntimeException('Not five meals');
    $corrected=$data;$corrected['breakfastDetails']='Respuesta corregida';
    capture(fn()=>handleDietaryRecall($pdo,'recall.save',['recallDate'=>'2000-01-01','recall'=>$corrected]));
    if(readDietaryRecall($pdo,91001,'2000-01-01')['recall']['breakfastDetails']!=='Respuesta corregida')throw new RuntimeException('Completed survey could not be corrected');
    capture(fn()=>handleDietaryRecall($pdo,'recall.save',['recallDate'=>'2000-01-02','recall'=>$data]),409);
    if((int)$pdo->query('SELECT COUNT(*) FROM dietary_recalls')->fetchColumn()!==1)throw new RuntimeException('Second initial survey saved');
    $_SERVER['REQUEST_METHOD']='GET';$initial=capture(fn()=>handleDietaryRecall($pdo,'recall.initial',[]));
    if(!$initial['completed']||$initial['recall']['afternoonSnackTime']!=='17:00')throw new RuntimeException('Initial state incorrect');
    $_SERVER['REQUEST_METHOD']='POST';$custom=$suggested;$custom['breakfastTime']='09:00';
    capture(fn()=>handleMealSchedule($pdo,'schedule.save',['schedule'=>$custom,'userId'=>91002]),403);
    capture(fn()=>handleMealSchedule($pdo,'schedule.save',['schedule'=>$custom]));
    $loaded=readMealSchedule($pdo,91001);
    if(!$loaded['customized']||$loaded['schedule']['breakfastTime']!=='09:00')throw new RuntimeException('Custom hours lost');
    ensureMealSchedule($pdo,91001,initialRecallRecord($pdo,91001));
    if(readMealSchedule($pdo,91001)['schedule']['breakfastTime']!=='09:00')throw new RuntimeException('Suggestions overwrote custom hours');
    if(readDietaryRecall($pdo,91001,'2000-01-01')['recall']['breakfastTime']!=='08:00')throw new RuntimeException('Baseline was overwritten');
    $other=issueAuthToken($pdo,91002);$_SERVER['HTTP_AUTHORIZATION']='Bearer '.$other;
    capture(fn()=>handleMealSchedule($pdo,'schedule.save',['schedule'=>$custom]),409);
    if(readMealSchedule($pdo,91002)['schedule']!==null)throw new RuntimeException('Cross-user schedule');
    $pdo->exec("INSERT INTO dietary_recalls(user_id,recall_date,wake_time,wake_activity,sleep_time,completed_at) VALUES(91002,'2000-01-01','07:00','Legacy test','23:00',NOW())");
    $legacy=readMealSchedule($pdo,91002);validateMealSchedule($legacy['schedule']);
    if(!$legacy['initialCompleted'])throw new RuntimeException('Existing completed survey was ignored');
}finally{
    $pdo->exec('USE eatwell_db');$pdo->exec("DROP DATABASE `$test`");
}
echo "Initial recall and schedule tests passed: five meals, one-time completion, immutable baseline, editable hours, isolation and rollback.\n";
