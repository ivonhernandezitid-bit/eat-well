<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require dirname(__DIR__).'/lifestyle-goals.php';
require dirname(__DIR__).'/food-preferences.php';
require dirname(__DIR__).'/auth-session.php';
function extractFunctions(string $source):array{
    $tokens=token_get_all($source);$positions=[];$offset=0;$result=[];
    foreach($tokens as $token){$positions[]=$offset;$offset+=strlen(is_array($token)?$token[1]:$token);}
    foreach($tokens as $i=>$token){
        if(!is_array($token)||$token[0]!==T_FUNCTION)continue;
        $j=$i+1;while(is_array($tokens[$j])&&$tokens[$j][0]===T_WHITESPACE)++$j;
        if(!is_array($tokens[$j])||$tokens[$j][0]!==T_STRING)continue;
        $name=$tokens[$j][1];while($tokens[$j]!=='{')++$j;$depth=1;
        for(++$j;isset($tokens[$j]);++$j){$part=$tokens[$j];if($part==='{'||(is_array($part)&&in_array($part[0],[T_CURLY_OPEN,T_DOLLAR_OPEN_CURLY_BRACES],true)))++$depth;if($part==='}'&&--$depth===0)break;}
        $result[$name]=substr($source,$positions[$i],$positions[$j]+1-$positions[$i]);
    }return $result;
}
$functions=extractFunctions(file_get_contents(dirname(__DIR__).'/index.php'));
foreach(['getUserById','mapUser','decodeJsonList','getFoodPreferencesRecord','mapFoodPreferences'] as $name)eval($functions[$name]);
class ApiResponse extends RuntimeException{public function __construct(public array $body,public int $status){}}
function sendJson(array $body,int $status=200):void{throw new ApiResponse($body,$status);}
function sendError(string $message,int $status=400):void{throw new ApiResponse(['error'=>$message],$status);}
function check(bool $condition,string $message):void{if(!$condition)throw new RuntimeException($message);}
function capture(callable $call,int $status=200):array{try{$call();}catch(ApiResponse $response){check($response->status===$status,'Unexpected response '.$response->status);return $response->body;}throw new RuntimeException('Missing response.');}
$settings=['goal'=>'gain_muscle','targetWeightKg'=>75.5,'activityBand'=>'intense','exerciseTypes'=>['strength','walking'],'sessionDuration'=>60,'trainingTime'=>'evening','cookingTime'=>'flexible','stressLevel'=>'low'];
validateLifestyleSettings($settings);
foreach([['targetWeightKg'=>0],['targetWeightKg'=>351],['goal'=>'invalid'],['activityBand'=>'invalid'],['sessionDuration'=>35],['exerciseTypes'=>['none','walking']],['exerciseTypes'=>['unknown']],['trainingTime'=>'bad'],['stressLevel'=>'bad']] as $bad){
    try{validateLifestyleSettings([...$settings,...$bad]);throw new LogicException('Invalid settings accepted.');}catch(InvalidArgumentException){}
}
$pdo=new PDO('mysql:host=127.0.0.1;dbname=eatwell_db;charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$schemas=[];foreach(['users','lifestyle_goals','food_preferences'] as $table)$schemas[]=$pdo->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM)[1];
$database='eatwell_lifestyle_check_'.bin2hex(random_bytes(6));$tokens=[];
$pdo->exec("CREATE DATABASE `$database` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
try{
    $pdo->exec("USE `$database`");foreach($schemas as $schema)$pdo->exec($schema);
    $pdo->exec("INSERT INTO users(id,name,username,email,password_hash) VALUES(94001,'Synthetic','goals_1','goals1@example.invalid','fake'),(94002,'Synthetic','goals_2','goals2@example.invalid','fake')");
    $_GET=[];$_SERVER['REQUEST_METHOD']='GET';capture(fn()=>handleLifestyleGoals($pdo,'lifestyle.get',[]),401);
    $tokens[]=issueAuthToken(94001);$_SERVER['HTTP_AUTHORIZATION']='Bearer '.$tokens[0];
    check(!capture(fn()=>handleLifestyleGoals($pdo,'lifestyle.get',[]))['completed'],'Empty goals marked complete.');
    $_SERVER['REQUEST_METHOD']='POST';capture(fn()=>handleLifestyleGoals($pdo,'lifestyle.save',['userId'=>94002,'settings'=>$settings]),403);
    foreach([['exerciseTypes'=>[]],['exerciseTypes'=>['none'],'activityBand'=>'intense'],['goal'=>'lose_weight','targetWeightKg'=>80]] as $bad) capture(fn()=>handleLifestyleGoals($pdo,'lifestyle.save',['settings'=>[...$settings,...$bad]]),422);
    $saved=capture(fn()=>handleLifestyleGoals($pdo,'lifestyle.save',['settings'=>$settings]));
    foreach($settings as $field=>$value)check($saved['settings'][$field]===$value,'Setting not persisted: '.$field);
    check($saved['completed']&&$saved['user']['goal']==='gain_muscle'&&$saved['user']['activityLevel']==='high','Profile not synchronized.');
    capture(fn()=>handleLifestyleGoals($pdo,'lifestyle.save',['settings'=>$settings]));check((int)$pdo->query('SELECT COUNT(*) FROM lifestyle_goals')->fetchColumn()===1,'Duplicate goal row.');
    $_SERVER['REQUEST_METHOD']='GET';check(capture(fn()=>handleLifestyleGoals($pdo,'lifestyle.get',[]))['settings']['targetWeightKg']===75.5,'Database reload failed.');
    $tokens[]=issueAuthToken(94002);$_SERVER['HTTP_AUTHORIZATION']='Bearer '.$tokens[1];
    check(!capture(fn()=>handleLifestyleGoals($pdo,'lifestyle.get',[]))['completed'],'Goals crossed accounts.');
    $_SERVER['REQUEST_METHOD']='POST';capture(fn()=>handleLifestyleGoals($pdo,'lifestyle.delete',['userId'=>94001]),403);
    $_SERVER['HTTP_AUTHORIZATION']='Bearer '.$tokens[0];
    $pdo->exec("CREATE TRIGGER fail_profile BEFORE UPDATE ON users FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic update failure'");
    try{persistLifestyleGoals($pdo,94001,validateLifestyleSettings([...$settings,'targetWeightKg'=>80]));throw new LogicException('Expected rollback.');}catch(PDOException){}
    check(readLifestyleGoals($pdo,94001)['settings']['targetWeightKg']===75.5,'Failed save left partial goals.');
    try{handleLifestyleGoals($pdo,'lifestyle.delete',[]);throw new LogicException('Expected rollback.');}catch(PDOException){}
    check(readLifestyleGoals($pdo,94001)['completed'],'Failed reset removed goals.');
    $pdo->exec('DROP TRIGGER fail_profile');
    $prefs=mapFoodPreferences(getFoodPreferencesRecord($pdo,94001));
    persistFoodPreferences($pdo,94001,validateFoodPreferences(['goal'=>'maintain','activityLevel'=>'low'],$prefs));
    $synced=readLifestyleGoals($pdo,94001)['settings'];check($synced['goal']==='maintain'&&$synced['activityBand']==='sedentary'&&$synced['targetWeightKg']===75.5,'Preference changes did not synchronize goals.');
    persistLifestyleGoals($pdo,94001,validateLifestyleSettings([...$settings,'activityBand'=>'light']));
    check((int)$pdo->query('SELECT cooking_time_minutes FROM food_preferences WHERE user_id=94001')->fetchColumn()===90,'Lifestyle cooking time did not synchronize preferences.');
    persistFoodPreferences($pdo,94001,validateFoodPreferences(['activityLevel'=>'low'],$prefs));
    check(readLifestyleGoals($pdo,94001)['settings']['activityBand']==='light','Fine activity band was lost.');
    check(isset(withLifestylePreferences($pdo,getUserById($pdo,94001),$prefs)['lifestyle']),'Recommendation context missing.');
    persistLifestyleGoals($pdo,94001,validateLifestyleSettings([...$settings,'activityBand'=>'sedentary','exerciseTypes'=>['none']],true));
    capture(fn()=>handleFoodPreferences($pdo,'preferences.save',['activityLevel'=>'high']),422);
    check(readLifestyleGoals($pdo,94001)['settings']['activityBand']==='sedentary','Rejected activity change changed goals.');
    capture(fn()=>handleFoodPreferences($pdo,'preferences.save',['cookingTimeMinutes'=>20]));
    check(readLifestyleGoals($pdo,94001)['settings']['cookingTime']==='short','Preferences cooking time did not synchronize lifestyle.');
    $deleted=capture(fn()=>handleLifestyleGoals($pdo,'lifestyle.delete',[]));check(!$deleted['completed']&&$deleted['settings']===null&&$deleted['user']['goal']==='improve_health','Reset not persisted.');
}finally{
    foreach($tokens as $token){session_id($token);session_start(['use_cookies'=>0,'cache_limiter'=>'']);$_SESSION=[];session_destroy();}
    $pdo->exec("DROP DATABASE `$database`");
}
echo "Lifestyle goals passed: all fields, reload, account/session isolation, transactional save/reset, preference synchronization and recipe context. No AI calls.\n";
