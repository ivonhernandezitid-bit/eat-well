<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
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
foreach(['getUserById','mapUser','getFoodPreferencesRecord','mapFoodPreferences','decodeJsonList'] as $name)eval($functions[$name]);
class ApiResponse extends RuntimeException{public function __construct(public array $body,public int $status){}}
function sendJson(array $body,int $status=200):void{throw new ApiResponse($body,$status);}
function sendError(string $message,int $status=400):void{throw new ApiResponse(['error'=>$message],$status);}
function check(bool $condition,string $message):void{if(!$condition)throw new RuntimeException($message);}
function capture(callable $call,int $status=200):array{try{$call();}catch(ApiResponse $response){check($response->status===$status,'Unexpected response '.$response->status);return $response->body;}throw new RuntimeException('Missing response.');}
function invalid(callable $call):void{try{$call();}catch(InvalidArgumentException){return;}throw new RuntimeException('Invalid data accepted.');}
$pdo=new PDO('mysql:host=127.0.0.1;dbname=eatwell_db;charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$schemas=[];foreach(['users','food_preferences','lifestyle_goals'] as $table)$schemas[]=$pdo->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM)[1];
$database='eatwell_preferences_check_'.bin2hex(random_bytes(6));$tokens=[];
$pdo->exec("CREATE DATABASE `$database` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
try{
    $pdo->exec("USE `$database`");foreach($schemas as $schema)$pdo->exec($schema);
    $pdo->exec('ALTER TABLE food_preferences ADD COLUMN IF NOT EXISTS no_preference_categories LONGTEXT NULL');
    $pdo->exec("INSERT INTO users(id,name,username,email,password_hash) VALUES(93001,'Synthetic','prefs_1','prefs1@example.invalid','fake'),(93002,'Synthetic','prefs_2','prefs2@example.invalid','fake')");
    $_GET=[];$_SERVER['REQUEST_METHOD']='GET';capture(fn()=>handleFoodPreferences($pdo,'preferences.get',[]),401);
    $tokens[]=issueAuthToken($pdo,93001);$_SERVER['HTTP_AUTHORIZATION']='Bearer '.$tokens[0];
    $initial=capture(fn()=>handleFoodPreferences($pdo,'preferences.get',[]));check(!$initial['preferences']['completed'],'Empty preferences marked complete.');
    $input=[...$initial['preferences'],'preferredFruits'=>['Manzana','Pitaya'],'preferredVegetables'=>['Brócoli'],'preferredProteins'=>['Tofu'],'preferredCarbohydrates'=>['Arroz'],'preferredLegumes'=>['Lentejas'],'preferredDairy'=>['Bebida de soya'],'preferredFats'=>['Aceite de oliva'],'allergies'=>['Cacahuate','Otra alergia'],'dislikedFoods'=>['Cebolla','Alimento personalizado'],'cookingTimeMinutes'=>45,'goal'=>'maintain','activityLevel'=>'high'];
    $_SERVER['REQUEST_METHOD']='POST';capture(fn()=>handleFoodPreferences($pdo,'preferences.save',[...$input,'userId'=>93002]),403);
    $saved=capture(fn()=>handleFoodPreferences($pdo,'preferences.save',$input));
    foreach(['preferredFruits','preferredVegetables','preferredProteins','preferredCarbohydrates','preferredLegumes','preferredDairy','preferredFats','allergies','dislikedFoods'] as $field)check($saved['preferences'][$field]===$input[$field],'List not persisted: '.$field);
    check($saved['user']['goal']==='maintain'&&$saved['user']['activityLevel']==='high','Profile fields not saved.');
    check($saved['preferences']['completed']&&$saved['preferences']['cookingTimeMinutes']===45,'Completion or time missing.');
    $incompleteRecord=getFoodPreferencesRecord($pdo,93001);$incompleteRecord['preferred_fruits']='[]';
    check(!mapFoodPreferences($incompleteRecord)['completed'],'A legacy incomplete category was marked complete.');
    capture(fn()=>handleFoodPreferences($pdo,'preferences.save',['preferredFruits'=>['Pera']]));
    check((int)$pdo->query('SELECT COUNT(*) FROM food_preferences')->fetchColumn()===1,'Repeated save duplicated preferences.');
    check(mapFoodPreferences(getFoodPreferencesRecord($pdo,93001))['allergies']===$input['allergies'],'Partial save erased allergies.');
    $_SERVER['REQUEST_METHOD']='GET';capture(fn()=>handleFoodPreferences($pdo,'preferences.get',['userId'=>93002]),403);
    $tokens[]=issueAuthToken($pdo,93002);$_SERVER['HTTP_AUTHORIZATION']='Bearer '.$tokens[1];
    check(!capture(fn()=>handleFoodPreferences($pdo,'preferences.get',[]))['preferences']['completed'],'Preferences crossed accounts.');
    $_SERVER['REQUEST_METHOD']='POST';capture(fn()=>handleFoodPreferences($pdo,'preferences.delete',['userId'=>93001]),403);
    $_SERVER['HTTP_AUTHORIZATION']='Bearer '.$tokens[0];
    $before=mapFoodPreferences(getFoodPreferencesRecord($pdo,93001));
    $pdo->exec("CREATE TRIGGER fail_profile BEFORE UPDATE ON users FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic profile failure'");
    try{persistFoodPreferences($pdo,93001,validateFoodPreferences([...$input,'preferredFruits'=>['Mango'],'goal'=>'gain_muscle'],$before));throw new LogicException('Expected rollback.');}catch(PDOException){}
    check(mapFoodPreferences(getFoodPreferencesRecord($pdo,93001))===$before,'Preferences were partially saved.');
    check(getUserById($pdo,93001)['goal']==='maintain','Failed profile update changed goal.');
    $pdo->exec('DROP TRIGGER fail_profile');
    foreach([['dietType'=>'invalid'],['allergies'=>'bad'],['allergies'=>[123]],['cookingTimeMinutes'=>0],['cookingTimeMinutes'=>15.5],['goal'=>'invalid'],['activityLevel'=>'invalid']] as $bad)invalid(fn()=>validateFoodPreferences($bad,$before));
    $normalized=validateFoodPreferences(['allergies'=>[' Cacahuate ','cacahuate']],$before);check($normalized['allergies']===['Cacahuate'],'Duplicate preferences retained.');
    $confirmed=validateFoodPreferences([...$input,'preferredFruits'=>[],'noPreferenceCategories'=>['fruits']],$before);
    check($confirmed['noPreferenceCategories']===['fruits'],'Explicit no-preference confirmation was not retained.');
    invalid(fn()=>validateFoodPreferences([...$input,'preferredFruits'=>[],'noPreferenceCategories'=>[]],$before));
    invalid(fn()=>validateFoodPreferences([...$input,'noPreferenceCategories'=>['unknown']],$before));
    foreach([
        ['preferredFruits'=>['Manzana'],'dislikedFoods'=>['manzana']],
        ['preferredProteins'=>['Pollo'],'dietType'=>'vegetarian'],
        ['preferredProteins'=>['Huevo'],'dietType'=>'vegan'],
        ['preferredDairy'=>['Leche sin lactosa'],'allergies'=>['Lacteos']],
        ['preferredFats'=>['Crema de cacahuate'],'allergies'=>['Cacahuate']],
        ['preferredProteins'=>['Tofu'],'allergies'=>['Soya']],
        ['preferredCarbohydrates'=>['Pan integral'],'allergies'=>['Gluten']],
        ['preferredProteins'=>['Salmón'],'allergies'=>['Pescado']],
        ['preferredProteins'=>['Camarón'],'allergies'=>['Mariscos']],
        ['preferredLegumes'=>['Lentejas'],'allergies'=>['Legumbres']],
    ] as $bad) invalid(fn()=>validateFoodPreferences($bad,$before));
    validateFoodPreferences(['preferredDairy'=>['Leche sin lactosa'],'allergies'=>['Lactosa']],$before);
    validateFoodPreferences(['dietType'=>'vegan','preferredDairy'=>['Bebida de almendra'],'allergies'=>['Lacteos']],$before);
    $_SERVER['REQUEST_METHOD']='POST';capture(fn()=>handleFoodPreferences($pdo,'preferences.save',['preferredFruits'=>['Manzana'],'dislikedFoods'=>['Manzana']]),422);
    check(mapFoodPreferences(getFoodPreferencesRecord($pdo,93001))===$before,'Rejected conflict changed preferences.');
    $deleted=capture(fn()=>handleFoodPreferences($pdo,'preferences.delete',[]));check(!$deleted['preferences']['completed']&&$deleted['preferences']['allergies']===[],'Deletion not reflected.');
    $categories=['fruits','vegetables','proteins','carbohydrates','legumes','dairy','fats','allergies','dislikedFoods'];
    $confirmations=[...$input,'preferredFruits'=>[],'preferredVegetables'=>[],'preferredProteins'=>[],'preferredCarbohydrates'=>[],'preferredLegumes'=>[],'preferredDairy'=>[],'preferredFats'=>[],'allergies'=>[],'dislikedFoods'=>[],'noPreferenceCategories'=>$categories];
    $confirmedSave=capture(fn()=>handleFoodPreferences($pdo,'preferences.save',$confirmations));
    check($confirmedSave['preferences']['completed']&&$confirmedSave['preferences']['noPreferenceCategories']===$categories,'No-preference confirmations were not persisted.');
}finally{
    $pdo->exec("DROP DATABASE `$database`");
}
echo "Food preferences passed: persistent lists, custom foods, profile transaction, reload, ownership, validation and deletion. No AI calls.\n";
