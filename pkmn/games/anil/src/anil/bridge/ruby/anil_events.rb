module AnilBridge
  EVENTS_FILE = __FILE__
  EVENT_RING_SIZE = 1000
  EVENT_TEXT_DEPTH = 1
  REVEALS = :@anil_reveals
  SHOWN_SIDE_EFFECTS = %w[Reflect LightScreen AuroraVeil Safeguard Mist Tailwind LuckyChant Rainbow SeaOfFire Swamp
                          Spikes ToxicSpikes StealthRock StickyWeb].freeze
  SHOWN_FIELD_EFFECTS = %w[TrickRoom Gravity WonderRoom MagicRoom WaterSportField MudSportField].freeze
  LAYERED_EFFECTS = %w[Spikes ToxicSpikes].freeze

  @event_seq = 0
  @event_ring = []
  @reveal_items = {}
  @reveal_start_items = []
  @reveal_moves = []
  @reveal_disguised = {}
  @reveal_held_disguised = {}
  @reveal_swaps = []
  @effect_baseline = nil

  def self.event_seq
    @event_seq
  end

  def self.event(kind, data)
    @event_seq += 1
    entry = { "seq" => @event_seq, "tick" => @tick, "kind" => kind, "data" => data }
    @event_ring.push(entry)
    @event_ring.shift while @event_ring.size > EVENT_RING_SIZE
    record("event", "seq" => @event_seq, "event" => kind, "data" => data)
  rescue Exception => error
    log_exception("event #{kind}", error)
  end

  def self.event_text(value)
    dump(value, EVENT_TEXT_DEPTH, {}, [], [])
  rescue Exception => error
    log_exception("event text", error)
    nil
  end

  def self.battle_text(via, message, battle = nil)
    event("battle_text", "text" => event_text(message), "via" => via)
    return unless battle
    reveal_effects(battle)
    reveal_text(battle, message)
  end

  def self.effect_value(name, raw)
    return nil unless raw == true || (raw.is_a?(Integer) && raw > 0)
    LAYERED_EFFECTS.include?(name) ? raw : true
  end

  def self.effect_values(battle)
    values = {}
    battle.sides.each_with_index do |side, index|
      SHOWN_SIDE_EFFECTS.each do |name|
        values[[index.to_s, name]] = effect_value(name, side.effects[PBEffects.const_get(name)])
      end
    end
    SHOWN_FIELD_EFFECTS.each do |name|
      values[["field", name]] = effect_value(name, battle.field.effects[PBEffects.const_get(name)])
    end
    values
  end

  def self.reveal_effects(battle)
    return if @effect_baseline.nil? || !battle.is_a?(Battle)
    store = reveals
    return if store.nil?
    current = effect_values(battle)
    shown = (store["effects"] ||= {})
    current.each do |key, value|
      before = @effect_baseline[key]
      next if before == value
      place, name = key
      listed = (shown[place] ||= {})
      if value.nil?
        listed.delete(name)
        next
      end
      entry = { "turn" => before && listed[name] ? listed[name]["turn"] : battle.turnCount }
      entry["layers"] = value unless value == true
      listed[name] = entry
    end
    @effect_baseline = current
  rescue Exception => error
    log_exception("reveal effects", error)
  end

  def self.effect_baseline(battle)
    return if @effect_baseline.nil? || !battle.is_a?(Battle)
    @effect_baseline = effect_values(battle)
  rescue Exception => error
    log_exception("effect baseline", error)
  end

  def self.reveals
    return nil if $PokemonGlobal.nil?
    store = $PokemonGlobal.instance_variable_get(REVEALS)
    return store if store.is_a?(Hash)
    store = { "trainers" => {}, "wild" => {} }
    $PokemonGlobal.instance_variable_set(REVEALS, store)
    store
  end

  def self.reveal_battle(battle)
    @reveal_items = {}
    @reveal_start_items = reveal_start_items(battle)
    @reveal_moves = []
    @reveal_disguised = {}
    @reveal_held_disguised = {}
    @reveal_swaps = []
    clear_wild_reveals
    @effect_baseline = {}
    effect_baseline(battle)
    begin
      yield
    ensure
      @effect_baseline = nil
      clear_wild_reveals
      @reveal_items = {}
      @reveal_start_items = []
      @reveal_moves = []
      @reveal_disguised = {}
      @reveal_held_disguised = {}
      @reveal_swaps = []
    end
  end

  def self.reveal_start_items(battle)
    battle.initialItems[1].dup
  rescue Exception => error
    log_exception("reveal start items", error)
    []
  end

  def self.reveal_trainer_key(tr_type, tr_name, tr_version)
    data = GameData::Trainer.try_get(tr_type, tr_name, tr_version)
    data ? data.id : [tr_type, tr_name, tr_version]
  rescue Exception => error
    log_exception("reveal trainer key", error)
    [tr_type, tr_name, tr_version]
  end

  def self.clear_wild_reveals
    store = reveals
    return if store.nil?
    store["wild"] = {}
    store["held"] = {}
    store["effects"] = {}
  rescue Exception => error
    log_exception("clear wild reveals", error)
  end

  def self.opposing?(battler)
    battler.is_a?(Battle::Battler) && !battler.dummy && battler.index.odd? && !battler.pokemon.nil?
  end

  def self.reveal_trainer_id(trainer)
    key = trainer.instance_variable_get(:@anil_trainer_id)
    key ||= [trainer.trainer_type, trainer.name, trainer.respond_to?(:version) ? trainer.version : 0]
    key.map(&:to_s).join(":")
  end

  def self.shown_party_index(battler)
    disguise = battler.effects[PBEffects::Illusion]
    return battler.pokemonIndex if disguise.nil?
    party = battler.battle.pbParty(battler.index)
    party.rindex { |pkmn| pkmn && pkmn.personalID == disguise.personalID } || battler.pokemonIndex
  end

  def self.reveal_owner(battler, party_index = battler.pokemonIndex)
    battle = battler.battle
    return [nil, party_index] unless battle.trainerBattle?
    owner = battle.pbGetOwnerIndexFromPartyIndex(battler.index, party_index)
    start = battle.pbPartyStarts(battler.index)[owner]
    [reveal_trainer_id(battle.opponent[owner]), party_index - start]
  end

  def self.start_item(battler)
    @reveal_start_items[battler.pokemonIndex]
  end

  def self.seen_items(battler)
    seen = (@reveal_items[battler.pokemonIndex] ||= [start_item(battler)].compact)
    seen.push(battler.item_id) if battler.item_id && !seen.include?(battler.item_id)
    seen
  end

  def self.reveal(battler, fact, via)
    return unless opposing?(battler)
    store = reveals
    return if store.nil?
    true_owner = reveal_owner(battler)
    shown = reveal_owner(battler, shown_party_index(battler))
    disguised = shown != true_owner
    @reveal_disguised.each_value { |entries| entries.delete([shown, fact]) } unless disguised
    list = reveal_list(store, *shown)
    return if list.include?(fact)
    list.push(fact)
    (@reveal_disguised[true_owner] ||= []).push([shown, fact]) if disguised
    reveal_event(battler, shown, fact, via)
  rescue Exception => error
    log_exception("reveal", error)
  end

  def self.reveal_list(store, trainer, slot)
    trainer ? ((store["trainers"][trainer] ||= {})[slot] ||= []) : (store["wild"][slot] ||= [])
  end

  def self.reveal_event(battler, owner, fact, via)
    trainer, slot = owner
    event("reveal", "battler" => battler.index, "side" => battler.index & 1, "trainer" => trainer, "slot" => slot, "fact" => fact, "via" => via)
  end

  def self.watch_illusions(battle, via, screen_always)
    disguised = battle.battlers.select { |battler| opposing?(battler) && battler.effects[PBEffects::Illusion] }
    result = yield
    disguised.each do |battler|
      next if battler.effects[PBEffects::Illusion]
      next unless screen_always || !battler.effects[PBEffects::Transform]
      reveal_illusion_break(battler, via)
    end
    result
  end

  def self.reveal_illusion_break(battler, via)
    store = reveals
    return if store.nil?
    move_disguised_held(store, battler)
    true_owner = reveal_owner(battler)
    entries = @reveal_disguised.delete(true_owner) || []
    target = reveal_list(store, *true_owner)
    illusion = { "kind" => "ability", "id" => "ILLUSION", "own" => battler.pokemon.ability_id == :ILLUSION }
    entries.each do |shown, fact|
      held = shown[0] ? store["trainers"][shown[0]] : store["wild"]
      list = held && held[shown[1]]
      if list
        list.delete(fact)
        held.delete(shown[1]) if list.empty?
      end
      next if target.include?(fact)
      target.push(fact)
      reveal_event(battler, true_owner, fact, via)
    end
    return if target.include?(illusion)
    target.push(illusion)
    reveal_event(battler, true_owner, illusion, via)
  rescue Exception => error
    log_exception("reveal illusion break", error)
  end

  def self.move_disguised_held(store, battler)
    saved = @reveal_held_disguised.delete(battler.pokemonIndex)
    return if saved.nil? || saved.empty?
    held_items = (store["held"] ||= {})
    item = held_items[saved.keys.last]
    saved.each { |index, (had, prior)| had ? held_items[index] = prior : held_items.delete(index) }
    held_items[battler.pokemonIndex] = item
  end

  def self.reveal_move(battler, move, via)
    return unless opposing?(battler) && move
    own = battler.moves.any? { |known| known.equal?(move) } && !battler.effects[PBEffects::Transform]
    reveal(battler, { "kind" => "move", "id" => move.id.to_s, "own" => own }, via)
  rescue Exception => error
    log_exception("reveal move", error)
  end

  def self.reveal_ability(battler, ability, via)
    return unless opposing?(battler) && ability
    own = ability == battler.pokemon.ability_id && !battler.effects[PBEffects::Transform]
    reveal(battler, { "kind" => "ability", "id" => ability.to_s, "own" => own }, via)
  rescue Exception => error
    log_exception("reveal ability", error)
  end

  def self.reveal_item(battler, item, via)
    return unless opposing?(battler) && item
    item = GameData::Item.try_get(item)&.id
    return if item.nil?
    seen_items(battler)
    reveal_held(battler, battler.item_id == item ? item.to_s : nil)
    reveal(battler, { "kind" => "item", "id" => item.to_s, "own" => item == start_item(battler) }, via)
  rescue Exception => error
    log_exception("reveal item", error)
  end

  def self.reveal_held(battler, item)
    store = reveals
    return if store.nil?
    held_items = (store["held"] ||= {})
    index = shown_party_index(battler)
    if index == battler.pokemonIndex
      @reveal_held_disguised.each_value { |saved| saved.delete(index) }
    else
      saved = (@reveal_held_disguised[battler.pokemonIndex] ||= {})
      saved[index] = saved.delete(index) || [held_items.key?(index), held_items[index]]
    end
    held_items[index] = item
  end

  def self.reveal_item_gone(battler, item)
    return unless opposing?(battler) && item && battler.item_id != item
    held = reveals&.dig("held")
    reveal_held(battler, nil) if held && held[shown_party_index(battler)] == item.to_s
  rescue Exception => error
    log_exception("reveal item gone", error)
  end

  def self.reveal_send_out(battle, send_outs)
    send_outs.each do |entry|
      battler = battle.battlers[entry[0]]
      next unless opposing?(battler)
      seen_items(battler)
      trainer, slot = reveal_owner(battler)
      illusion = battler.effects[PBEffects::Illusion]
      fact = { "kind" => "send_out", "species" => battler.displaySpecies.to_s, "illusion" => !illusion.nil? }
      event("reveal", "battler" => battler.index, "side" => battler.index & 1, "trainer" => trainer, "slot" => slot, "fact" => fact, "via" => "pbSendOut")
    end
  rescue Exception => error
    log_exception("reveal send out", error)
  end

  def self.swapping_items(user, target)
    @reveal_swaps.push(item_swaps(user, target))
    begin
      yield
    ensure
      @reveal_swaps.pop
    end
  end

  def self.item_swaps(user, target)
    [[user, target], [target, user]].filter_map do |battler, other|
      next unless opposing?(battler) && !opposing?(other) && battler.item_id
      [battler, battler.item_id, battler.itemName, other]
    end
  rescue Exception => error
    log_exception("item swaps", error)
    []
  end

  def self.reveal_swap_text(message)
    (@reveal_swaps.last || []).each do |battler, item, name, other|
      next unless message == _INTL("{1} obtuvo {2}.", other.pbThis, name)
      index = shown_party_index(battler)
      held = reveals&.dig("held", index)
      reveal_item(battler, item, "text")
      reveal_held(battler, held) if held && held == battler.item_id&.to_s
    end
  end

  def self.reveal_text(battle, message)
    return unless battle.is_a?(Battle) && message.is_a?(String)
    user, choice = @reveal_moves.last
    if user && choice && choice[2] && message == _INTL("¡{1} ha usado {2}!", user.pbThis, choice[2].name)
      reveal_move(user, choice[2], "text")
    end
    reveal_swap_text(message)
    battle.battlers.each do |battler|
      next unless opposing?(battler)
      next unless message.include?(battler.pbThis) || message.include?(battler.pbThis(true))
      named = seen_items(battler).select do |item|
        name = GameData::Item.try_get(item)&.name
        name && !name.empty? && message.include?(name)
      end
      named.each { |item| reveal_item(battler, item, "text") }
      reveal_held(battler, battler.item_id.to_s) if named.include?(battler.item_id)
      [battler.ability_id, battler.pokemon.ability_id].compact.uniq.each do |ability|
        name = GameData::Ability.try_get(ability)&.name
        reveal_ability(battler, ability, "text") if name && !name.empty? && message.include?(name)
      end
    end
  rescue Exception => error
    log_exception("reveal text", error)
  end

  def self.using_move(battler, choice)
    @reveal_moves.push([battler, choice])
    begin
      yield
    ensure
      @reveal_moves.pop
    end
  end

  def self.debug_log(message)
    event("debug_log", "text" => event_text(message))
  end

  def self.check_since(request)
    since = request["since"]
    return if since.nil? || (since.is_a?(Integer) && since >= 0)
    raise ArgumentError, "since must be a non-negative integer"
  end

  def self.events_since(request)
    since = request.is_a?(Hash) ? request["since"] : nil
    return [[], false] unless since.is_a?(Integer) && since >= 0
    events = @event_ring.select { |entry| entry["seq"] > since }
    [events, since < @event_seq - @event_ring.size]
  end

  def self.install_event_hooks
    hook("Battle battle text") do
      Battle.class_eval do
        alias_method :anil_bridge_display, :pbDisplay
        def pbDisplay(msg, &block)
          AnilBridge.battle_text("pbDisplay", msg, self)
          anil_bridge_display(msg, &block)
        ensure
          AnilBridge.effect_baseline(self)
        end
        alias_method :anil_bridge_display_paused, :pbDisplayPaused
        def pbDisplayPaused(msg, &block)
          AnilBridge.battle_text("pbDisplayPaused", msg, self)
          anil_bridge_display_paused(msg, &block)
        ensure
          AnilBridge.effect_baseline(self)
        end
        alias_method :anil_bridge_display_brief, :pbDisplayBrief
        def pbDisplayBrief(msg)
          AnilBridge.battle_text("pbDisplayBrief", msg, self)
          anil_bridge_display_brief(msg)
        ensure
          AnilBridge.effect_baseline(self)
        end
        alias_method :anil_bridge_attack_phase, :pbAttackPhase
        def pbAttackPhase(*args)
          AnilBridge.effect_baseline(self)
          anil_bridge_attack_phase(*args)
        end
      end
    end
    install_reveal_hooks
    hook("PBDebug.log") do
      class << PBDebug
        alias_method :anil_bridge_debug_log, :log
        def log(msg)
          AnilBridge.debug_log(msg)
          anil_bridge_debug_log(msg)
        end
      end
    end
  end

  def self.install_reveal_hooks
    hook("pbLoadTrainer trainer id") do
      Object.class_eval do
        alias_method :anil_bridge_load_trainer, :pbLoadTrainer
        def pbLoadTrainer(tr_type, tr_name, tr_version = 0)
          trainer = anil_bridge_load_trainer(tr_type, tr_name, tr_version)
          trainer&.instance_variable_set(:@anil_trainer_id, AnilBridge.reveal_trainer_key(tr_type, tr_name, tr_version))
          trainer
        end
        private :pbLoadTrainer, :anil_bridge_load_trainer
      end
    end
    hook("Battle reveals") do
      Battle.class_eval do
        alias_method :anil_bridge_reveal_start_battle, :pbStartBattle
        def pbStartBattle(*args)
          AnilBridge.reveal_battle(self) { anil_bridge_reveal_start_battle(*args) }
        end
        alias_method :anil_bridge_show_ability_splash, :pbShowAbilitySplash
        def pbShowAbilitySplash(battler, *args)
          AnilBridge.reveal_ability(battler, battler.ability_id, "pbShowAbilitySplash") if Battle::Scene::USE_ABILITY_SPLASH
          anil_bridge_show_ability_splash(battler, *args)
        end
        alias_method :anil_bridge_replace_ability_splash, :pbReplaceAbilitySplash
        def pbReplaceAbilitySplash(battler)
          AnilBridge.reveal_ability(battler, battler.ability_id, "pbReplaceAbilitySplash") if Battle::Scene::USE_ABILITY_SPLASH
          anil_bridge_replace_ability_splash(battler)
        end
        alias_method :anil_bridge_send_out, :pbSendOut
        def pbSendOut(sendOuts, startBattle = false)
          result = anil_bridge_send_out(sendOuts, startBattle)
          AnilBridge.reveal_send_out(self, sendOuts)
          result
        end
      end
    end
    hook("Battle::Move#pbDisplayUseMessage") do
      Battle::Move.class_eval do
        alias_method :anil_bridge_display_use_message, :pbDisplayUseMessage
        def pbDisplayUseMessage(user)
          AnilBridge.reveal_move(user, self, "pbDisplayUseMessage")
          anil_bridge_display_use_message(user)
        end
      end
    end
    hook("Battle::Move::UserTargetSwapItems item swaps") do
      Battle::Move::UserTargetSwapItems.class_eval do
        alias_method :anil_bridge_swap_items, :pbEffectAgainstTarget
        def pbEffectAgainstTarget(user, target)
          AnilBridge.swapping_items(user, target) { anil_bridge_swap_items(user, target) }
        end
      end
    end
    hook("Battle::AbilityEffects Illusion breaks") do
      Battle::AbilityEffects.singleton_class.class_eval do
        alias_method :anil_bridge_trigger_on_being_hit, :triggerOnBeingHit
        def triggerOnBeingHit(ability, user, target, move, battle)
          AnilBridge.watch_illusions(battle, "triggerOnBeingHit", true) { anil_bridge_trigger_on_being_hit(ability, user, target, move, battle) }
        end
        alias_method :anil_bridge_trigger_on_switch_in, :triggerOnSwitchIn
        def triggerOnSwitchIn(ability, battler, battle, switch_in = false)
          AnilBridge.watch_illusions(battle, "triggerOnSwitchIn", false) { anil_bridge_trigger_on_switch_in(ability, battler, battle, switch_in) }
        end
      end
    end
    hook("Battle::Battler reveals") do
      Battle::Battler.class_eval do
        alias_method :anil_bridge_use_move, :pbUseMove
        def pbUseMove(choice, specialUsage = false)
          AnilBridge.using_move(self, choice) { anil_bridge_use_move(choice, specialUsage) }
        end
        alias_method :anil_bridge_held_item_triggered, :pbHeldItemTriggered
        def pbHeldItemTriggered(item_to_use, own_item = true, fling = false)
          AnilBridge.reveal_item(self, item_to_use, "pbHeldItemTriggered") if own_item
          anil_bridge_held_item_triggered(item_to_use, own_item, fling)
        end
        alias_method :anil_bridge_on_losing_ability, :pbOnLosingAbility
        def pbOnLosingAbility(*args)
          AnilBridge.watch_illusions(@battle, "pbOnLosingAbility", false) { anil_bridge_on_losing_ability(*args) }
        end
        alias_method :anil_bridge_remove_item, :pbRemoveItem
        def pbRemoveItem(*args)
          removed = item_id
          result = anil_bridge_remove_item(*args)
          AnilBridge.reveal_item_gone(self, removed)
          result
        end
        alias_method :anil_bridge_consume_item, :pbConsumeItem
        def pbConsumeItem(*args)
          AnilBridge.reveal_item(self, item_id, "pbConsumeItem")
          anil_bridge_consume_item(*args)
        end
      end
    end
  end
end
