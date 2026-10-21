module AnilBridge
  CONTEXT_FILE = __FILE__
  PAYLOAD_DEPTH = 3
  FRAME_METHOD = /:in `[^']*'\z/

  @frames = []
  @signature = ""
  @payloads = []
  @payload_live = {}

  Live = Struct.new(:source, :reader, :claims)
  CURSOR = ->(window) { { "cursor" => window.index } }
  DIGITS = ->(window) { { "value" => window.number, "digit" => window.instance_variable_get(:@index) } }
  COUNT = ->(window) { { "value" => window.text[/x(\d+)/, 1].to_i } }
  BAG_LIVE = lambda do |scene|
    list = scene.instance_variable_get(:@sprites)["itemlist"]
    { "pocket" => list.pocket, "cursor" => list.index, "item" => list.item }
  end
  STORAGE_BOX_LIVE = lambda do |scene|
    { "box" => scene.instance_variable_get(:@storage).currentBox, "cursor" => AnilBridge.storage_cursor(scene.instance_variable_get(:@anil_selection)) }
  end
  REGION_MAP_LIVE = lambda do |scene|
    x = scene.instance_variable_get(:@map_x)
    y = scene.instance_variable_get(:@map_y)
    cursor = scene.instance_variable_get(:@sprites)["cursor"]
    settled = cursor.x == scene.point_x_to_screen_x(x) && cursor.y == scene.point_y_to_screen_y(y)
    { "x" => x, "y" => y, "settled" => settled }
  end
  STORAGE_PARTY_LIVE = ->(scene) { { "cursor" => scene.instance_variable_get(:@anil_selection) } }
  MOVE_REMINDER_LIVE = lambda do |screen|
    moves = screen.instance_variable_get(:@moves).map { |entry| [entry[0].is_a?(GameData::Move) ? entry[0].id : entry[0], entry[1]] }
    { "cursor" => screen.index, "moves" => moves, "known" => screen.pokemon.moves.map(&:id) }
  end
  MART_LIVE = lambda do |scene|
    list = scene.instance_variable_get(:@sprites)["itemwindow"]
    { "cursor" => list.index, "item" => AnilBridge.item_id(list.item) }
  end

  def self.own_frame?(frame)
    frame.index(CONTEXT_FILE) == 0 || frame.index(BRIDGE_FILE) == 0 || frame.index(READ_FILE) == 0 || frame.index(DRIVE_FILE) == 0 || frame.index(SPEED_FILE) == 0 || frame.index(RECORD_FILE) == 0 || frame.index(SNAPSHOT_FILE) == 0 || frame.index(EVENTS_FILE) == 0
  end

  def self.game_frames(frames)
    frames.reject { |frame| own_frame?(frame) }
  end

  def self.observe_stack(frames)
    @frames = game_frames(frames)
    @signature = stack_signature(@frames)
  end

  def self.stack_signature(frames)
    frames.map { |frame| frame.sub(FRAME_METHOD, "") }.join("|")
  end

  def self.frames
    @frames
  end

  def self.signature
    @signature
  end

  def self.payloads
    @payloads.map { |payload| live_payload(payload) }
  end

  def self.live_payload(payload)
    copy = payload.dup
    live = @payload_live[payload.object_id]
    return copy if live.nil? || live.source.nil?
    return copy if live.source.respond_to?(:disposed?) && live.source.disposed?
    begin
      live.reader.call(live.source).each { |name, value| copy[name] = dump(value, PAYLOAD_DEPTH, {}, [], []) }
    rescue Exception => error
      log_exception("live payload #{payload['kind']}", error)
    end
    copy
  end

  def self.claim_window(window)
    payload = @payloads.last
    return if payload.nil?
    live = @payload_live[payload.object_id]
    return if live.nil? || !live.source.nil? || live.claims.nil? || !window.is_a?(live.claims)
    live.source = window
  end

  def self.with_payload(kind, fields, live = nil)
    payload = { "kind" => kind, "tick" => @tick }
    begin
      fields.each { |name, value| payload[name] = dump(value, PAYLOAD_DEPTH, {}, [], []) }
    rescue Exception => error
      log_exception("payload #{kind}", error)
    end
    @payloads.push(payload)
    @payload_live[payload.object_id] = live if live
    begin
      yield
    ensure
      @payloads.delete_if { |entry| entry.equal?(payload) }
      @payload_live.delete(payload.object_id)
    end
  end

  def self.wrap(owner, method, kind, live = nil, &fields)
    original = :"anil_bridge_#{method}"
    hidden = owner.private_method_defined?(method)
    owner.class_eval do
      alias_method original, method
      define_method(method) do |*args, &block|
        AnilBridge.with_payload(kind, AnilBridge.payload_fields(kind, fields, self, args), AnilBridge.live_for(live, self)) { send(original, *args, &block) }
      end
      private method, original if hidden
    end
  end

  def self.live_for(live, receiver)
    return nil if live.nil?
    Live.new(live.claims ? nil : receiver, live.reader, live.claims)
  end

  def self.payload_fields(kind, fields, receiver, args)
    fields.call(receiver, *args)
  rescue Exception => error
    log_exception("payload #{kind}", error)
    {}
  end

  def self.target_id(target)
    target.respond_to?(:id) ? target.id : target
  end

  def self.claims(window_class, reader)
    Live.new(nil, reader, window_class)
  end

  def self.reads(reader)
    Live.new(nil, reader, nil)
  end

  def self.choice_live
    claims(Window_CommandPokemon, CURSOR)
  end

  def self.battle_window(name)
    ->(scene) { { "cursor" => scene.instance_variable_get(:@sprites)[name].index } }
  end

  def self.item_id(item)
    item.is_a?(GameData::Item) ? item.id : item
  end

  def self.storage_cursor(selection)
    [-4, -5].include?(selection) ? -1 : selection
  end

  def self.install_context_hooks
    hook("pbMessageDisplay") do
      wrap(Object, :pbMessageDisplay, "message") { |_, _window, text| { "text" => text } }
    end
    hook("pbShowCommands") do
      wrap(Object, :pbShowCommands, "choice", choice_live) do |_, _window, commands = nil, cancel = 0, default = 0|
        { "options" => commands, "cancel" => cancel, "default" => default }
      end
    end
    hook("pbChooseNumber") do
      wrap(Object, :pbChooseNumber, "number", claims(Window_InputNumberPokemon, DIGITS)) do |_, _window, params|
        params ? { "min" => params.minNumber, "max" => params.maxNumber, "initial" => params.initialNumber, "cancel" => params.cancelNumber } : {}
      end
    end
    hook("window claims") do
      [Window_CommandPokemon, Window_InputNumberPokemon, Window_UnformattedTextPokemon, Window_AdvancedTextPokemon].each do |window_class|
        window_class.class_eval do
          alias_method :anil_bridge_claim_initialize, :initialize
          def initialize(*args, &block)
            anil_bridge_claim_initialize(*args, &block)
            AnilBridge.claim_window(self)
          end
        end
      end
    end
    hook("Battle::Scene battle menus") do
      wrap(Battle::Scene, :pbCommandMenuEx, "battle_command", reads(battle_window("commandWindow"))) do |_, battler, texts, mode = 0|
        { "battler" => battler, "texts" => texts, "mode" => mode }
      end
      wrap(Battle::Scene, :pbFightMenu, "battle_fight", reads(battle_window("fightWindow"))) { |_, battler, *| { "battler" => battler } }
      wrap(Battle::Scene, :pbChooseTarget, "battle_target", reads(battle_window("targetWindow"))) do |_, battler, target_data, *|
        { "battler" => battler, "target" => AnilBridge.target_id(target_data) }
      end
      wrap(Battle::Scene, :pbPartyScreen, "battle_switch") do |_, battler, can_cancel = false, mode = 0|
        { "battler" => battler, "can_cancel" => can_cancel, "mode" => mode }
      end
      wrap(Battle::Scene, :pbItemMenu, "battle_bag") do |_, battler, first_action = nil|
        { "battler" => battler, "first_action" => first_action }
      end
    end
    hook("Battle catch store") do
      wrap(Battle::CatchAndStoreMixin, :pbStorePokemon, "store") do |battle, pkmn|
        { "name" => pkmn.name, "species" => pkmn.species, "item" => pkmn.item_id, "send_to_boxes" => battle.sendToBoxes, "shiny" => pkmn.shiny?, "personal_id" => pkmn.personalID }
      end
    end
    hook("Battle::Scene battle messages") do
      wrap(Battle::Scene, :pbDisplayMessage, "message") { |_, text, *| { "text" => text } }
      wrap(Battle::Scene, :pbDisplayPausedMessage, "message") { |_, text| { "text" => text } }
      wrap(Battle::Scene, :pbShowCommands, "choice", choice_live) do |_, text, commands, default = -1|
        { "text" => text, "options" => commands, "default" => default }
      end
    end
    install_screen_hooks
  end

  def self.install_screen_hooks
    hook("pause menu") do
      wrap(DP_PauseMenu, :main, "menu", reads(->(menu) { { "cursor" => menu.instance_variable_get(:@option) } })) do |menu|
        { "screen" => "pause", "options" => menu.instance_variable_get(:@options).map(&:first) }
      end
    end
    hook("party screen") do
      wrap(PokemonParty_Scene, :pbChoosePokemon, "menu", reads(->(scene) { { "cursor" => scene.instance_variable_get(:@activecmd) } })) do |scene, switching = false, *|
        { "screen" => "party", "switching" => switching, "cancel" => max_party_size + (scene.instance_variable_get(:@multiselect) ? 1 : 0) }
      end
      wrap(PokemonParty_Scene, :pbDisplay, "message") { |_, text| { "screen" => "party", "text" => text } }
      wrap(PokemonParty_Scene, :pbDisplayConfirm, "choice", choice_live) do |_, text|
        { "screen" => "party", "text" => text, "options" => [_INTL("Sí"), _INTL("No")] }
      end
      wrap(PokemonParty_Scene, :pbShowCommands, "choice", choice_live) do |_, text, commands, index = 0|
        { "screen" => "party", "text" => text, "options" => commands, "default" => index }
      end
      wrap(PokemonParty_Scene, :pbChooseNumber, "number", claims(Window_UnformattedTextPokemon, COUNT)) do |_, text, maximum, initial = 1|
        { "screen" => "party", "text" => text, "min" => 1, "max" => maximum, "initial" => initial }
      end
    end
    hook("bag screen") do
      wrap(PokemonBag_Scene, :pbChooseItem, "menu", reads(BAG_LIVE)) { |_| { "screen" => "bag" } }
      wrap(PokemonBag_Scene, :pbChoosePoke, "menu", reads(->(scene) { { "cursor" => scene.instance_variable_get(:@activecmd) } })) do |_, option, switching = false|
        { "screen" => "bag_party", "option" => option, "switching" => switching }
      end
      wrap(PokemonBag_Scene, :pbDisplay, "message") { |_, text, brief = false| { "screen" => "bag", "text" => text, "brief" => brief } }
      wrap(PokemonBag_Scene, :pbConfirm, "choice", choice_live) do |_, text|
        { "screen" => "bag", "text" => text, "options" => [_INTL("Sí"), _INTL("No")] }
      end
      wrap(PokemonBag_Scene, :pbShowCommands, "choice", choice_live) do |_, text, commands, index = 0|
        { "screen" => "bag", "text" => text, "options" => commands, "default" => index }
      end
      wrap(PokemonBag_Scene, :pbChooseNumber, "number", claims(Window_UnformattedTextPokemon, COUNT)) do |_, text, maximum, initial = 1|
        { "screen" => "bag", "text" => text, "min" => 1, "max" => maximum, "initial" => initial }
      end
    end
    hook("storage screen") do
      PokemonStorageScene.class_eval do
        alias_method :anil_bridge_pbSetArrow, :pbSetArrow
        def pbSetArrow(arrow, selection)
          @anil_selection = selection
          anil_bridge_pbSetArrow(arrow, selection)
        end
        alias_method :anil_bridge_pbPartySetArrow, :pbPartySetArrow
        def pbPartySetArrow(arrow, selection)
          @anil_selection = selection
          anil_bridge_pbPartySetArrow(arrow, selection)
        end
      end
      wrap(PokemonStorageScene, :pbSelectBoxInternal, "menu", reads(STORAGE_BOX_LIVE)) { |_, *| { "screen" => "storage_box" } }
      wrap(PokemonStorageScene, :pbSelectPartyInternal, "menu", reads(STORAGE_PARTY_LIVE)) do |_, _party, depositing|
        { "screen" => "storage_party", "depositing" => depositing }
      end
      wrap(PokemonStorageScene, :pbDisplay, "message") { |_, text| { "screen" => "storage", "text" => text } }
      wrap(PokemonStorageScene, :pbShowCommands, "choice", choice_live) do |_, text, commands, index = 0|
        { "screen" => "storage", "text" => text, "options" => commands, "default" => index }
      end
    end
    hook("mart screen") do
      wrap(PokemonMart_Scene, :pbChooseBuyItem, "menu", reads(MART_LIVE)) do |scene|
        { "screen" => "mart_buy", "stock" => scene.instance_variable_get(:@stock).map { |item| AnilBridge.item_id(item) } }
      end
      wrap(PokemonMart_Scene, :pbDisplay, "message") { |_, text, brief = false| { "screen" => "mart", "text" => text, "brief" => brief } }
      wrap(PokemonMart_Scene, :pbDisplayPaused, "message") { |_, text| { "screen" => "mart", "text" => text } }
      wrap(PokemonMart_Scene, :pbConfirm, "choice", choice_live) do |_, text|
        { "screen" => "mart", "text" => text, "options" => [_INTL("Sí"), _INTL("No")] }
      end
      wrap(PokemonMart_Scene, :pbChooseNumber, "number", claims(Window_AdvancedTextPokemon, COUNT)) do |_, text, item, maximum|
        { "screen" => "mart", "text" => text, "item" => AnilBridge.item_id(item), "min" => 1, "max" => maximum, "initial" => 1 }
      end
    end
    hook("naming screen") do
      wrap(PokemonEntryScene, :pbEntry1, "naming", reads(->(scene) { { "text" => scene.instance_variable_get(:@sprites)["entry"].text } })) do |scene|
        subject = scene.instance_variable_get(:@sprites)["subject"]
        pokemon = subject.is_a?(PokemonIconSprite) ? subject.pokemon : nil
        forced = !pokemon.nil? && defined?(ChallengeModes) && ChallengeModes.on?(:FORCE_NICKNAME) ? true : false
        { "screen" => "naming", "min" => scene.instance_variable_get(:@minlength), "max" => scene.instance_variable_get(:@maxlength), "species" => pokemon&.species, "forced" => forced }
      end
    end
    hook("forget move screen") do
      wrap(PokemonSummary_Scene, :pbChooseMoveToForget, "menu", reads(->(scene) { { "cursor" => scene.instance_variable_get(:@sprites)["movesel"].index } })) do |scene, move|
        pokemon = scene.instance_variable_get(:@pokemon)
        { "screen" => "forget_move", "move" => move, "moves" => pokemon.moves.map(&:id), "species" => pokemon.species, "personal_id" => pokemon.personalID }
      end
    end
    hook("move relearner") do
      wrap(UI::MoveReminder, :main, "menu", reads(MOVE_REMINDER_LIVE)) do |screen|
        pokemon = screen.pokemon
        { "screen" => "move_reminder", "species" => pokemon.species, "personal_id" => pokemon.personalID, "party_index" => $player.party.index(pokemon) }
      end
      wrap(UI::MoveReminderVisuals, :show_message, "message") { |_, text| { "screen" => "move_reminder", "text" => text } }
      wrap(UI::MoveReminderVisuals, :show_confirm_message, "choice", choice_live) do |_, text|
        { "screen" => "move_reminder", "text" => text, "options" => [_INTL("Sí"), _INTL("No")] }
      end
    end
    hook("evolution scene") do
      wrap(PokemonEvolutionScene, :pbEvolution, "evolution") do |scene, cancancel = true|
        pokemon = scene.instance_variable_get(:@pokemon)
        { "screen" => "evolution", "species" => pokemon.species, "new_species" => scene.instance_variable_get(:@newspecies), "can_cancel" => cancancel }
      end
    end
    hook("region map") do
      wrap(PokemonRegionMap_Scene, :pbMapScene, "menu", reads(REGION_MAP_LIVE)) do |scene|
        { "screen" => "region_map", "fly" => scene.instance_variable_get(:@fly_map) ? true : false, "region" => scene.instance_variable_get(:@map)&.id }
      end
    end
    hook("pokedex entry") do
      wrap(PokemonPokedexInfo_Scene, :pbSceneBrief, "pokedex") { |scene| { "species" => scene.instance_variable_get(:@species) } }
    end
    hook("stat boxes") do
      wrap(Object, :pbTopRightWindow, "message") { |_, text, *| { "screen" => "stats", "text" => text } }
    end
    hook("save slots") do
      wrap(PokemonSaveScreen, :slotSelectCommands, "choice", choice_live) do |_, choices, _info, default = 0|
        { "screen" => "save", "text" => _INTL("¿En qué archivo vas a guardar?"), "options" => choices, "default" => default }
      end
    end
  end

  def self.hook(name)
    yield
    log("hooked #{name}")
  rescue Exception => error
    log_exception("hook #{name}", error)
  end
end
