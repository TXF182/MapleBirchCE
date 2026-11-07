/* 自动生成，勿手改：node tools/gen_test_fixture.js
 * 来源：原版 Degrees of Lewdity Degrees of Lewdity.html 中的三个性别判定函数原文。
 * 用途：integration_gender 在无原版 HTML 时用同一段真实逻辑断言（替代 SKIP）。
 * 许可：仅为本地测试取证片段，不进发布包，不再分发。 */
/* isGenitalMismatch */
function isGenitalMismatch() {
	if (V.player.sex === "h") {
		return "herm";
	}
	if (V.player.sex !== V.player.gender && V.settings.nudeGenderPerception === 0) {
		return true;
	}
	return false;
}

/* isCrossdressing */
function isCrossdressing() {
	if (
		getVisibleClothesList().some(item => ["f", "m"].includes(item.gender) && item.gender !== V.player.sex && item.gender === V.player.gender_appearance) &&
		!isGenitalMismatch()
	) {
		return true;
	}
	return false;
}

/* isHermOrCrossdresser */
function isHermOrCrossdresser() {
	if (V.player.sex === "h") {
		return "herm";
	}
	if (isCrossdressing() || (V.player.sex !== V.player.gender_appearance && !isGenitalMismatch())) {
		return true;
	}
	return false;
}
