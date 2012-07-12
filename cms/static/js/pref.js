$(function() {	
	
	function setUnsaved(){
		$("#tablemenu input[type=submit]").removeClass('saved').addClass('unsaved');
	}
		
	function setSaved(){
		$("#tablemenu input[type=submit]").removeClass('unsaved').addClass('saved');
	}

	$(document).on("submit", "#editprefs", function() {
		var uri = $(this).attr("action");
		$.ajax({
			type: 'POST',
			url: uri,
			data: $(this).serializeArray(),
			success: function(name) {
				setSaved();
			}
		});
		return false;
	});
	
	$(document).on("mouseover", "#editprefs .button", function() {
		$(this).css('cursor', 'pointer');
	});
	
	$(document).on("mouseout", "#editprefs .button", function() {
		$(this).css('cursor', 'auto');
	});
	
	$(document).on("change", "#editprefs .select", function() {
		setUnsaved();
	});
	
});