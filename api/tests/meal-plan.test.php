<?php
declare(strict_types=1);
// Regresión del plan: validar caché, calendario y elecciones guardadas contra fixtures aislados sin invocar IA; EATWELL_API_ROOT permite repetirla contra la instalación XAMPP.
// CAMBIO: cubre elecciones del catálogo, validación de preferencias/comida, persistencia y ausencia de nutrición inventada en una base temporal.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$apiRoot = getenv('EATWELL_API_ROOT') ?: dirname(__DIR__);
require_once $apiRoot . '/meal-plan.php';
require_once $apiRoot . '/auth-session.php';
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
$functions=extractFunctions(file_get_contents($apiRoot.'/index.php'));
foreach(['getUserById','getFoodPreferencesRecord','mapFoodPreferences','decodeJsonList','cleanStringList','cleanText','mapPersonalizedRecipe','mapFavoriteRecipe','addFavoriteRecipe','filterRecipesByPreferences','mapRecipe'] as $name)eval($functions[$name]);
if (isset($functions['catalogRecipeMealTypes'])) eval($functions['catalogRecipeMealTypes']);
class ApiResponse extends RuntimeException { public function __construct(public array $body, public int $status) {} }
function sendJson(array $body,int $status=200):void{throw new ApiResponse($body,$status);}
function sendError(string $message,int $status=400,?string $code=null):void{throw new ApiResponse($code===null?['error'=>$message]:['error'=>$message,'code'=>$code],$status);}
function capture(callable $call,int $status=200):array{try{$call();}catch(ApiResponse $r){if($r->status!==$status)throw new RuntimeException('Unexpected response '.$r->status);return $r->body;}throw new RuntimeException('Missing response.');}
function check(bool $value,string $message):void{if(!$value)throw new RuntimeException($message);}
function invalid(callable $call):void{try{$call();}catch(InvalidArgumentException){return;}throw new RuntimeException('Invalid data accepted.');}
$generationCalls=0;
$lastPrompt='';
function requestGeminiText(string $key,string $model,string $prompt,array $schema):array{
    global $generationCalls,$lastPrompt;++$generationCalls;$lastPrompt=$prompt;
    $type=null;foreach(RECIPE_MEAL_TYPES as $candidate)if(str_contains($prompt,'mealTypes=["'.$candidate.'"]'))$type=$candidate;
    if($type===null)throw new RuntimeException('Category missing from prompt.');
    $recipes=[];for($i=0;$i<MEAL_PLAN_OPTION_COUNT;++$i)$recipes[]=['recipe_title'=>'Synthetic '.$type.' '.$i,'title'=>'Synthetic '.$type.' '.$i,'description'=>'Test recipe','prep_time_minutes'=>10,'calories'=>150,'proteins_g'=>5,'carbs_g'=>20,'fats_g'=>4,'mealTypes'=>[$type],'servings'=>1,'preparationMinutes'=>10,'validationNotes'=>[], 'ingredients'=>['40 g de AVENA CRUDA'],'ingredientData'=>[['foodId'=>0,'name'=>'AVENA CRUDA','quantity'=>40,'unit'=>'g']],'instructions'=>['Cocina y sirve.']];
    return $recipes;
}
invalid(fn()=>validatePlanDate('2026-02-30','2026-02-28'));
invalid(fn()=>validatePlanDate('2026-10-20','2026-10-11'));
invalid(fn()=>validatePlanDate('2026-10-10','2026-10-11'));
invalid(fn()=>validatePlanDate('2026-10-18','2026-10-11'));
check(validatePlanDate('2026-10-11','2026-10-11')==='2026-10-11','Start of rolling calendar rejected.');
check(validatePlanDate('2026-10-17','2026-10-11')==='2026-10-17','End of rolling calendar rejected.');
$pdo=new PDO('mysql:host=127.0.0.1;dbname=eatwell_db;charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$schemas=[];foreach(['users','food_preferences','recipes','favorite_recipes','personalized_recipes','daily_meal_choices','dietary_recalls','meal_schedules','lifestyle_goals','clinical_histories'] as $table)$schemas[]=$pdo->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM)[1];
$database='eatwell_meal_plan_check_'.bin2hex(random_bytes(6));$tokens=[];
$pdo->exec("CREATE DATABASE `$database` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
try{
    $pdo->exec("USE `$database`");foreach($schemas as $schema)$pdo->exec($schema);
    $pdo->exec("INSERT INTO users(id,name,username,email,password_hash) VALUES(92001,'Synthetic','plan_test_1','plan1@example.invalid','fake'),(92002,'Synthetic','plan_test_2','plan2@example.invalid','fake')");
    $noPreferenceCategories=json_encode(['fruits','vegetables','proteins','carbohydrates','legumes','dairy','fats','allergies','dislikedFoods'],JSON_THROW_ON_ERROR);
    $preferencesStatement=$pdo->prepare('INSERT INTO food_preferences(user_id,no_preference_categories,completed_at) VALUES(?,?,NOW()),(?,?,NOW())');
    $preferencesStatement->execute([92001,$noPreferenceCategories,92002,$noPreferenceCategories]);
    // Los favoritos guardan estimaciones validadas, pero un valor registrado enviado por el cliente nunca se eleva a dato del catálogo.
    $favorite=capture(fn()=>addFavoriteRecipe($pdo,[
        'userId'=>92001,'title'=>'Favorite nutrition fixture','description'=>'Synthetic','recipeId'=>'999',
        'ingredients'=>[],'instructions'=>['Sirve.'],
        'estimatedNutrition'=>['calories'=>'0','proteinGrams'=>5,'carbsGrams'=>20,'fatGrams'=>4],
        'registeredNutrition'=>['calories'=>9999,'proteinGrams'=>9999,'carbsGrams'=>9999,'fatGrams'=>9999],
    ]),201)['recipe'];
    check($favorite['estimatedNutrition']===['calories'=>0.0,'proteinGrams'=>5.0,'carbsGrams'=>20.0,'fatGrams'=>4.0],'Favorite estimates did not survive saving and reading.');
    check($favorite['nutrition']['sources']['calories']==='estimate'
        && $favorite['registeredNutrition']['calories']===null,'Client-supplied values were trusted as catalog nutrition.');
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
    $previousCacheHash=hash('sha256',recipePreferenceHash($user,$preferences).':'.MEAL_PLAN_OPTION_COUNT.'-options-v3:breakfast');
    check(mealOptionHash($user,$preferences,'breakfast')!==$previousCacheHash,'Incomplete v3 nutrition caches are still reusable.');
    $legacyCacheHash=hash('sha256',recipePreferenceHash($user,$preferences).':'.MEAL_PLAN_OPTION_COUNT.'-options-v4:breakfast');
    $legacyInsert=$pdo->prepare('INSERT INTO personalized_recipes (user_id,preference_hash,title,description,ingredients,instructions) VALUES (?,?,?,?,?,?)');
    $legacyIds=[];
    for($i=0;$i<MEAL_PLAN_OPTION_COUNT;++$i){$legacyInsert->execute([92001,$legacyCacheHash,'Legacy '.$i,'Old cache','["40 g de AVENA CRUDA"]','["Sin metadata de nutricion"]']);$legacyIds[]=(int)$pdo->lastInsertId();}
    check(mealOptionHash($user,$preferences,'breakfast')!==$legacyCacheHash,'Incomplete v4 nutrition caches are still reusable.');
    check(count(compatibleMealOptionHashes($user,$preferences,'breakfast'))===1,'Outdated recipe option caches are still treated as selectable.');
    // Las elecciones antiguas se conservan en almacenamiento y se exponen como pendientes de revisión.
    $oldChoice=$pdo->prepare('INSERT INTO daily_meal_choices (user_id,plan_date,meal_type,recipe_id,preference_hash) VALUES (?,?,?,?,?)');
    $oldChoice->execute([92001,$today,'breakfast',$legacyIds[0],recipePreferenceHash($user,$preferences)]);
    $reviewPlan=readDailyMealChoices($pdo,$user,$preferences,$today);
    check(!isset($reviewPlan['choices']->breakfast)
        && $reviewPlan['meals'][0]['selectionStatus']==='needs_review','Old selected recipe was not clearly marked for review.');
    $source=null;$breakfast=readMealOptions($pdo,$user,$preferences,'breakfast','fake','fake',$source);check(count($breakfast)===MEAL_PLAN_OPTION_COUNT,'Unexpected number of breakfast options.');
    check($source==='generated','New options did not report their generation source.');
    check($breakfast[0]['estimatedNutrition']===['calories'=>150.0,'proteinGrams'=>5.0,'carbsGrams'=>20.0,'fatGrams'=>4.0],'Generated breakfast nutrition estimates were not preserved in the option cache.');
    check($breakfast[0]['proteinGrams']===5.0 && $breakfast[0]['carbsGrams']===20.0 && $breakfast[0]['fatGrams']===4.0,'Generated breakfast macros were not returned when verified nutrition was unavailable.');
    check(str_contains($lastPrompt,'Diabetes o resistencia a la insulina'),'Clinical guidance was not passed to recipe generation.');
    $source=null;$again=readMealOptions($pdo,$user,$preferences,'breakfast','fake','fake',$source);check($generationCalls===1 && $again[0]['id']===$breakfast[0]['id'] && $source==='cache','Cache called generator again or lost its source.');
    $lunch=readMealOptions($pdo,$user,$preferences,'lunch','fake','fake');check($generationCalls===2,'Different category not generated.');
    check((int)$pdo->query('SELECT COUNT(*) FROM personalized_recipes')->fetchColumn()===MEAL_PLAN_OPTION_COUNT*3,'Category cache erased legacy rows or other options.');
    $_SERVER['REQUEST_METHOD']='POST';capture(fn()=>handleMealPlan($pdo,'plan.choose',['date'=>$today,'mealType'=>'breakfast','recipeId'=>$breakfast[0]['id']],'fake','fake'));
    capture(fn()=>handleMealPlan($pdo,'plan.choose',['date'=>$today,'mealType'=>'breakfast','recipeId'=>'24'],'fake','fake'),422);
    capture(fn()=>handleMealPlan($pdo,'plan.choose',['date'=>$today,'mealType'=>'breakfast','recipeId'=>$lunch[0]['id']],'fake','fake'),422);
    $saved=capture(fn()=>handleMealPlan($pdo,'plan.choose',['date'=>$today,'mealType'=>'breakfast','recipeId'=>$breakfast[3]['id']],'fake','fake'));
    check($saved['choices']->breakfast['id']===$breakfast[3]['id'],'Replacement not saved.');
    // La lectura del plan devuelve el contrato de calendario completo y mantiene la elección persistida.
    $_SERVER['REQUEST_METHOD']='GET';
    $calendar=capture(fn()=>handleMealPlan($pdo,'plan.get',['date'=>$today],'fake','fake'));
    check($calendar['date']===$today && count($calendar['meals'])===5
        && $calendar['summary']['selectedMeals']===1
        && $calendar['meals'][0]['selectionStatus']==='selected'
        && $calendar['meals'][0]['recipe']['id']===$breakfast[3]['id'],'Calendar read lost its date, plan structure, or saved choice.');
    $_SERVER['REQUEST_METHOD']='POST';
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
    check((int)$pdo->query('SELECT COUNT(*) FROM personalized_recipes')->fetchColumn()===MEAL_PLAN_OPTION_COUNT*3,'Invalid generation changed or discarded cache rows.');
    $bad=array_fill(0,MEAL_PLAN_OPTION_COUNT,['title'=>'Duplicate','description'=>'Test','ingredients'=>['1 g de Test'],'ingredientData'=>[['foodId'=>0,'name'=>'Test','quantity'=>1,'unit'=>'g']],'instructions'=>['Serve'],'servings'=>1,'preparationMinutes'=>1,'mealTypes'=>['breakfast']]);
    try{validateGeneratedRecipeList($bad,MEAL_PLAN_OPTION_COUNT,'breakfast');throw new LogicException('Duplicate options accepted.');}catch(RuntimeException $error){check(!$error instanceof LogicException,'Duplicate options accepted.');}
    // Un conjunto completo en cantidad pero sin nutrición no se recicla ni provoca regeneración automática repetida.
    $incompleteHash=mealOptionHash($user,$preferences,'dinner');$incompleteIds=[];
    for($i=0;$i<MEAL_PLAN_OPTION_COUNT;++$i){$legacyInsert->execute([92001,$incompleteHash,'Incomplete '.$i,'Old cache','[]','["Legacy"]']);$incompleteIds[]=(int)$pdo->lastInsertId();}
    $oldDinnerChoice=$pdo->prepare('INSERT INTO daily_meal_choices (user_id,plan_date,meal_type,recipe_id,preference_hash) VALUES (?,?,?,?,?)');
    $oldDinnerChoice->execute([92001,$today,'dinner',$incompleteIds[0],recipePreferenceHash($user,$preferences)]);
    $generationCountBeforeReview=$generationCalls;
    try{readMealOptions($pdo,$user,$preferences,'dinner','fake','fake');throw new LogicException('Incomplete current cache was reused.');}
    catch(ApiResponse $response){check($response->status===409 && ($response->body['code']??null)==='options_cache_review','Incomplete cache did not request controlled review.');}
    check($generationCalls===$generationCountBeforeReview,'Incomplete cache triggered an automatic regeneration loop.');
    // El reintento explícito archiva el conjunto defectuoso sin borrar elecciones y deja una caché reutilizable.
    $source=null;$recovered=readMealOptions($pdo,$user,$preferences,'dinner','fake','fake',$source,true);
    check(count($recovered)===MEAL_PLAN_OPTION_COUNT && $source==='generated'
        && $generationCalls===$generationCountBeforeReview+1,'Explicit recovery did not generate a fresh option set.');
    check((int)$pdo->query('SELECT COUNT(*) FROM daily_meal_choices WHERE user_id=92001 AND plan_date='.$pdo->quote($today).' AND meal_type=\'dinner\'')->fetchColumn()===1,'Cache recovery deleted the saved choice.');
    $_SERVER['REQUEST_METHOD']='GET';$recoveredPlan=capture(fn()=>handleMealPlan($pdo,'plan.get',['date'=>$today],'fake','fake'));
    check($recoveredPlan['meals'][4]['selectionStatus']==='needs_review'
        && $recoveredPlan['meals'][4]['recipe']===null,'Archived selection was not retained as needing review.');
    $source=null;readMealOptions($pdo,$user,$preferences,'dinner','fake','fake',$source);
    check($source==='cache' && $generationCalls===$generationCountBeforeReview+1,'Recovered cache repeated generation or returned another review conflict.');
    // Fixtures del catálogo: nada se escribe en las recetas o elecciones reales del paciente.
    $catalogInsert=$pdo->prepare('INSERT INTO recipes(id,title,description,calories,protein_grams,carbs_grams,fat_grams,ingredients,instructions,goal) VALUES(?,?,?,?,?,?,?,?,?,?)');
    $catalogInsert->execute([96001,'Avena del catalogo','Desayuno',440,12,64,15,'1 taza de avena','Cocina y sirve.','maintain']);
    $catalogInsert->execute([96002,'Tostadas de atun','Cena',320,28,22,8,'2 latas de atun|3 tostadas','Mezcla y sirve.','maintain']);
    $catalogInsert->execute([96003,'Avena con azucar','Desayuno',500,12,70,15,'1 taza de avena|2 cucharadas de azucar','Cocina y sirve.','maintain']);
    $_SERVER['REQUEST_METHOD']='POST';
    $catalogSaved=capture(fn()=>handleMealPlan($pdo,'plan.choose',['date'=>$today,'mealType'=>'breakfast','recipeId'=>'96001'],'fake','fake'));
    check($catalogSaved['choices']->breakfast['id']==='96001','Catalog choice lost its public ID.');
    check($catalogSaved['choices']->breakfast['nutrition']['sources']['calories']==='catalog'
        && $catalogSaved['choices']->breakfast['nutrition']['perServing']['calories']===null,'Catalog nutrition was relabeled as verified per serving.');
    $catalogHash=catalogMealChoiceHash($user,$preferences,'breakfast',96001);
    capture(fn()=>handleMealPlan($pdo,'plan.choose',['date'=>$today,'mealType'=>'breakfast','recipeId'=>'96001'],'fake','fake'));
    $references=$pdo->prepare('SELECT COUNT(*) FROM personalized_recipes WHERE user_id=? AND preference_hash=?');
    $references->execute([92001,$catalogHash]);check((int)$references->fetchColumn()===1,'Repeated catalog choice created duplicate references.');
    capture(fn()=>handleMealPlan($pdo,'plan.choose',['date'=>$today,'mealType'=>'breakfast','recipeId'=>'96002'],'fake','fake'),422);
    capture(fn()=>handleMealPlan($pdo,'plan.choose',['date'=>$today,'mealType'=>'breakfast','recipeId'=>'96003'],'fake','fake'),422);
    $allergic=[...$preferences,'allergies'=>['avena']];
    invalid(fn()=>saveDailyMealChoice($pdo,$user,$allergic,$today,'breakfast','96001'));
    invalid(fn()=>saveDailyMealChoice($pdo,$user,[...$preferences,'completed'=>false],$today,'breakfast','96001'));
    check(!isset(((array)readDailyMealChoices($pdo,$user,$allergic,$today)['choices'])['breakfast']),'Changed preferences retained an incompatible catalog choice.');
    $_SERVER['REQUEST_METHOD']='GET';
    $catalogRead=capture(fn()=>handleMealPlan($pdo,'plan.get',['date'=>$today],'fake','fake'));
    check($catalogRead['choices']->breakfast['id']==='96001' && $catalogRead['choices']->breakfast['calories']===440.0,'Reload lost catalog selection or registered values.');
    check(!isset(((array)readDailyMealChoices($pdo,$user,$preferences,$tomorrow)['choices'])['breakfast']),'Catalog choice leaked to another day.');
    check(count((array)readDailyMealChoices($pdo,getUserById($pdo,92002),$preferences,$today)['choices'])===0,'Catalog choice leaked to another account.');
    $_SERVER['REQUEST_METHOD']='POST';
    $catalogDinner=capture(fn()=>handleMealPlan($pdo,'plan.choose',['date'=>$today,'mealType'=>'dinner','recipeId'=>'96002'],'fake','fake'));
    check($catalogDinner['choices']->dinner['id']==='96002','Catalog dinner could not be selected.');
    $personalizedAgain=capture(fn()=>handleMealPlan($pdo,'plan.choose',['date'=>$today,'mealType'=>'breakfast','recipeId'=>$breakfast[0]['id']],'fake','fake'));
    check($personalizedAgain['choices']->breakfast['id']===$breakfast[0]['id'],'Switching from catalog to personalized recipe failed.');
    $source=null;readMealOptions($pdo,$user,$preferences,'breakfast','fake','fake',$source);
    check($source==='cache' && $generationCalls===$generationCountBeforeReview+1,'Catalog references invalidated the AI option cache.');
}finally{
    $pdo->exec("DROP DATABASE `$database`");
}
echo "Meal plan passed: configured options, category cache, selections, replacement, account/date isolation, current preferences and verified session. No AI calls.\n";
