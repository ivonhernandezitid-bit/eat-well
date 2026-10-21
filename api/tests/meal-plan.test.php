<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__) . '/meal-plan.php';
require_once dirname(__DIR__) . '/auth-session.php';
function extractFunctions(string $source): array {
    $tokens=token_get_all($source);$offsets=[];$offset=0;$result=[];
    foreach($tokens as $token){$offsets[]=$offset;$offset+=strlen(is_array($token)?$token[1]:$token);}
    foreach($tokens as $i=>$token){
        if(!is_array($token)||$token[0]!==T_FUNCTION)continue;
        $j=$i+1;while(isset($tokens[$j])&&is_array($tokens[$j])&&$tokens[$j][0]===T_WHITESPACE)++$j;
        if(!isset($tokens[$j])||!is_array($tokens[$j])||$tokens[$j][0]!==T_STRING)continue;
        $name=$tokens[$j][1];while(isset($tokens[$j])&&$tokens[$j]!=='{')++$j;$depth=1;
        for(++$j;isset($tokens[$j]);++$j){$part=$tokens[$j];if($part==='{'||(is_array($part)&&in_array($part[0],[T_CURLY_OPEN,T_DOLLAR_OPEN_CURLY_BRACES],true)))++$depth;if($part==='}'&&--$depth===0)break;}
        $result[$name]=substr($source,$offsets[$i],$offsets[$j]+1-$offsets[$i]);
    }return $result;
}
$functions=extractFunctions(file_get_contents(dirname(__DIR__).'/index.php'));
foreach(['getUserById','getFoodPreferencesRecord','mapFoodPreferences','decodeJsonList','cleanStringList','cleanText','mapPersonalizedRecipe','filterRecipesByPreferences'] as $name)eval($functions[$name]);
class ApiResponse extends RuntimeException { public function __construct(public array $body, public int $status) {} }
function sendJson(array $body,int $status=200):void{throw new ApiResponse($body,$status);}
function sendError(string $message,int $status=400):void{throw new ApiResponse(['error'=>$message],$status);}
function capture(callable $call,int $status=200):array{try{$call();}catch(ApiResponse $r){if($r->status!==$status)throw new RuntimeException('Unexpected response '.$r->status);return $r->body;}throw new RuntimeException('Missing response.');}
function check(bool $value,string $message):void{if(!$value)throw new RuntimeException($message);}
function invalid(callable $call):void{try{$call();}catch(InvalidArgumentException){return;}throw new RuntimeException('Invalid data accepted.');}
$generationCalls=0;
$lastPrompt='';
function requestGeminiText(string $key,string $model,string $prompt,array $schema):array{
    global $generationCalls,$lastPrompt;++$generationCalls;$lastPrompt=$prompt;
    $type=null;foreach(RECIPE_MEAL_TYPES as $candidate)if(str_contains($prompt,'mealTypes=["'.$candidate.'"]'))$type=$candidate;
    if($type===null)throw new RuntimeException('Category missing from prompt.');
    $recipes=[];for($i=0;$i<7;++$i)$recipes[]=['title'=>'Synthetic '.$type.' '.$i,'description'=>'Test recipe','mealTypes'=>[$type],'servings'=>1,'preparationMinutes'=>10,'validationNotes'=>[], 'ingredients'=>['40 g de AVENA CRUDA'],'ingredientData'=>[['foodId'=>0,'name'=>'AVENA CRUDA','quantity'=>40,'unit'=>'g']],'instructions'=>['Cocina y sirve.']];
    return $recipes;
}
invalid(fn()=>validatePlanDate('2026-02-30','2026-02-28'));
invalid(fn()=>validatePlanDate('2026-10-20','2026-10-11'));
check(validatePlanDate('2026-10-12','2026-10-11')==='2026-10-12','Device date boundary rejected.');
$pdo=new PDO('mysql:host=127.0.0.1;dbname=eatwell_db;charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$schemas=[];foreach(['users','food_preferences','personalized_recipes','daily_meal_choices','lifestyle_goals','clinical_histories'] as $table)$schemas[]=$pdo->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM)[1];
$database='eatwell_meal_plan_check_'.bin2hex(random_bytes(6));$tokens=[];
$pdo->exec("CREATE DATABASE `$database` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
try{
    $pdo->exec("USE `$database`");foreach($schemas as $schema)$pdo->exec($schema);
    $pdo->exec("INSERT INTO users(id,name,username,email,password_hash) VALUES(92001,'Synthetic','plan_test_1','plan1@example.invalid','fake'),(92002,'Synthetic','plan_test_2','plan2@example.invalid','fake')");
    $pdo->exec("INSERT INTO food_preferences(user_id,completed_at) VALUES(92001,NOW()),(92002,NOW())");
    $_GET=[];$_SERVER['REQUEST_METHOD']='GET';$today=(new DateTimeImmutable('today',new DateTimeZone('America/Mexico_City')))->format('Y-m-d');
    capture(fn()=>handleMealPlan($pdo,'plan.get',['date'=>$today],'fake','fake'),401);
    $tokens[]=issueAuthToken($pdo,92001);$_SERVER['HTTP_AUTHORIZATION']='Bearer '.$tokens[0];
    $conditions=mealPlanClinicalConditions($pdo,92001);
    check(empty($conditions['diabetes']) && empty($conditions['chronicKidneyDisease']),'Empty history activated clinical filters.');
    $pdo->exec('INSERT INTO clinical_histories (user_id,diagnoses_none,diagnosis_metabolism_none,diagnosis_diabetes,diagnosis_insulin_resistance) VALUES (92001,0,0,1,0)');
    $conditions=mealPlanClinicalConditions($pdo,92001);
    check(!empty($conditions['diabetes']) && empty($conditions['insulinResistance']),'Selected clinical diagnosis was not loaded into meal planning.');
    $clinicalRecipes=[
        ['title'=>'Oatmeal','ingredients'=>['40 g de AVENA CRUDA'],'ingredientData'=>[['name'=>'AVENA CRUDA']]],
        ['title'=>'Sweet bread','ingredients'=>['20 g de azúcar'],'ingredientData'=>[['name'=>'azúcar']]],
    ];
    check(count(filterRecipesByClinicalConditions($clinicalRecipes,['diabetes'=>true]))===1,'Diabetes ingredient filter did not remove added sugar.');
    check(count(filterRecipesByClinicalConditions($clinicalRecipes,['hypertension'=>true,'gout'=>true]))===2,'Unrelated conditions over-filtered ingredients.');
    $highRiskRecipes=[
        ['title'=>'Sandwich','ingredients'=>['40 g de jamón'],'ingredientData'=>[['name'=>'jamón']]],
        ['title'=>'Seafood','ingredients'=>['40 g de sardinas'],'ingredientData'=>[['name'=>'sardinas']]],
    ];
    check(count(filterRecipesByClinicalConditions($highRiskRecipes,['hypertension'=>true,'gout'=>true]))===0,'Combined hypertension and gout filters did not exclude flagged ingredients.');
    check(count(filterRecipesByClinicalConditions($clinicalRecipes,['chronicKidneyDisease'=>true]))===2,'Renal diagnosis applied unsupported blanket food exclusions.');
    $guidance=recipeClinicalGuidance(['hypothyroidism'=>true,'chronicKidneyDisease'=>true]);
    check(count($guidance)===2 && str_contains(implode(' ',$guidance),'no fijes ni reduzcas automáticamente'),'Thyroid/renal safeguards missing from generation guidance.');
    capture(fn()=>handleMealPlan($pdo,'plan.options',['mealType'=>'invalid'],'fake','fake'),422);
    $_GET=['mealType'=>'breakfast'];capture(fn()=>handleMealPlan($pdo,'plan.options',['userId'=>92002],'fake','fake'),403);$_GET=[];
    $user=getUserById($pdo,92001);$preferences=mapFoodPreferences(getFoodPreferencesRecord($pdo,92001));$preferences['clinicalConditions']=$conditions;
    $breakfast=readMealOptions($pdo,$user,$preferences,'breakfast','fake','fake');check(count($breakfast)===7,'Not seven options.');
    check(str_contains($lastPrompt,'Diabetes o resistencia a la insulina'),'Clinical guidance was not passed to recipe generation.');
    $again=readMealOptions($pdo,$user,$preferences,'breakfast','fake','fake');check($generationCalls===1 && $again[0]['id']===$breakfast[0]['id'],'Cache called generator again.');
    $lunch=readMealOptions($pdo,$user,$preferences,'lunch','fake','fake');check($generationCalls===2,'Different category not generated.');
    check((int)$pdo->query('SELECT COUNT(*) FROM personalized_recipes')->fetchColumn()===14,'Category cache erased other options.');
    $_SERVER['REQUEST_METHOD']='POST';capture(fn()=>handleMealPlan($pdo,'plan.choose',['date'=>$today,'mealType'=>'breakfast','recipeId'=>$breakfast[0]['id']],'fake','fake'));
    capture(fn()=>handleMealPlan($pdo,'plan.choose',['date'=>$today,'mealType'=>'breakfast','recipeId'=>$lunch[0]['id']],'fake','fake'),422);
    $saved=capture(fn()=>handleMealPlan($pdo,'plan.choose',['date'=>$today,'mealType'=>'breakfast','recipeId'=>$breakfast[3]['id']],'fake','fake'));
    check($saved['choices']->breakfast['id']===$breakfast[3]['id'],'Replacement not saved.');
    check((int)$pdo->query('SELECT COUNT(*) FROM daily_meal_choices')->fetchColumn()===1,'Duplicate daily choice.');
    $tomorrow=(new DateTimeImmutable($today))->modify('+1 day')->format('Y-m-d');check(count((array)readDailyMealChoices($pdo,$user,$preferences,$tomorrow)['choices'])===0,'Selection leaked to another date.');
    $tokens[]=issueAuthToken($pdo,92002);$_SERVER['HTTP_AUTHORIZATION']='Bearer '.$tokens[1];
    capture(fn()=>handleMealPlan($pdo,'plan.choose',['date'=>$today,'mealType'=>'breakfast','recipeId'=>$breakfast[0]['id']],'fake','fake'),422);
    check(count((array)readDailyMealChoices($pdo,getUserById($pdo,92002),$preferences,$today)['choices'])===0,'Selection leaked to another account.');
    capture(fn()=>handleMealPlan($pdo,'plan.choose',['userId'=>92001,'date'=>$today,'mealType'=>'breakfast','recipeId'=>null],'fake','fake'),403);
    $_SERVER['HTTP_AUTHORIZATION']='Bearer '.$tokens[0];
    capture(fn()=>handleMealPlan($pdo,'plan.choose',['date'=>$today,'mealType'=>'lunch','recipeId'=>$lunch[0]['id']],'fake','fake'));
    $cleared=capture(fn()=>handleMealPlan($pdo,'plan.choose',['date'=>$today,'mealType'=>'breakfast','recipeId'=>null],'fake','fake'));
    check(!isset($cleared['choices']->breakfast) && isset($cleared['choices']->lunch),'Clear removed another meal or retained the choice.');
    capture(fn()=>handleMealPlan($pdo,'plan.choose',['date'=>$today,'mealType'=>'breakfast','recipeId'=>null],'fake','fake'));
    capture(fn()=>handleMealPlan($pdo,'plan.choose',['date'=>$today,'mealType'=>'breakfast'],'fake','fake'),422);
    capture(fn()=>handleMealPlan($pdo,'plan.choose',['date'=>$today,'mealType'=>'breakfast','recipeId'=>$breakfast[3]['id']],'fake','fake'));
    $changed=[...$preferences,'allergies'=>['avena']];check(count((array)readDailyMealChoices($pdo,$user,$changed,$today)['choices'])===0,'Old preference selection retained.');
    try{readMealOptions($pdo,$user,$changed,'breakfast','fake','fake');throw new LogicException('Incompatible recipe saved.');}catch(RuntimeException $error){check(!$error instanceof LogicException,'Incompatible recipe saved.');}
    check((int)$pdo->query('SELECT COUNT(*) FROM personalized_recipes')->fetchColumn()===14,'Invalid generation changed cache.');
    $bad=array_fill(0,7,['title'=>'Duplicate','description'=>'Test','ingredients'=>['1 g de Test'],'ingredientData'=>[['foodId'=>0,'name'=>'Test','quantity'=>1,'unit'=>'g']],'instructions'=>['Serve'],'servings'=>1,'preparationMinutes'=>1,'mealTypes'=>['breakfast']]);
    try{validateGeneratedRecipeList($bad,7,'breakfast');throw new LogicException('Duplicate options accepted.');}catch(RuntimeException $error){check(!$error instanceof LogicException,'Duplicate options accepted.');}
}finally{
    $pdo->exec("DROP DATABASE `$database`");
}
echo "Meal plan passed: seven options, category cache, selections, replacement, account/date isolation, current preferences and verified session. No AI calls.\n";
