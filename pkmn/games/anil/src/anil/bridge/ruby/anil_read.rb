module AnilBridge
  READ_FILE = __FILE__
  READ_DEFAULT_DEPTH = 8
  READ_MAX_DEPTH = 16
  READ_INSPECT_CHARS = 200
  READ_CLONE = Kernel.instance_method(:clone)
  PATH_ROOT = /\A(\$\w+|[A-Z]\w*(?:::[A-Z]\w*)*)/
  PATH_SEGMENT = /\A(?:\.(\w+[?!]?)(?:\(([^)]*)\))?|(@@?\w+)|\[([^\]]*)\])/
  PATH_LITERAL = /\A\s*(-?\d+|"(?:[^"\\]|\\.)*"|nil|true|false)\s*(?:,|\z)/

  @battle = nil
  @last_battle = nil
  @game_hooks = false

  def self.battle
    @battle
  end

  def self.in_battle(battle)
    outer = @battle
    @battle = battle
    begin
      yield
    ensure
      @battle = outer
      @last_battle = battle
    end
  end

  def self.last_battle
    @last_battle
  end

  def self.move_refusal(index, slot)
    battle = @battle
    return "no battle is running" if battle.nil?
    shown = []
    [:pbDisplay, :pbDisplayPaused].each do |method|
      battle.define_singleton_method(method) { |message, *_args, &_block| shown.push(message) }
    end
    begin
      allowed = battle.pbCanChooseMove?(index, slot, true)
    ensure
      [:pbDisplay, :pbDisplayPaused].each { |method| battle.singleton_class.send(:remove_method, method) }
    end
    allowed ? nil : (shown.first || "")
  end

  def self.run_refusal(index, during = false)
    battle = @battle
    return "no battle is running" if battle.nil?
    battler = battle.battlers[index]
    if !during && battler.effects[PBEffects::SkyDrop] >= 0
      return _INTL("¡Caída Libre no deja cambiar a {1}!", battler.pbThis(true))
    end
    if battle.trainerBattle?
      return _INTL("¡No puedes huir de un combate contra un Entrenador!") if battle.internalBattle
      return "running from this trainer battle forfeits it, which the battle layer does not do"
    end
    return _INTL("¡No puedes escapar!") unless battle.canRun
    return nil if during
    return nil if battler.pbHasType?(:GHOST) && Settings::MORE_TYPE_EFFECTS
    return nil if battler.abilityActive? && Battle::AbilityEffects.triggerCertainEscapeFromBattle(battler.ability, battler)
    return nil if battler.itemActive? && Battle::ItemEffects.triggerCertainEscapeFromBattle(battler.item, battler)
    return _INTL("¡No puedes huir!") if battler.trappedInBattle?
    battle.allOtherSideBattlers(index).each do |other|
      next unless other.abilityActive? && Battle::AbilityEffects.triggerTrappingByTarget(other.ability, battler, other, battle)
      return _INTL("¡{1} evita que se huya con {2}!", other.pbThis, other.abilityName)
    end
    battle.allOtherSideBattlers(index).each do |other|
      next unless other.itemActive? && Battle::ItemEffects.triggerTrappingByTarget(other.item, battler, other, battle)
      return _INTL("¡{1} evita que se huya con {2}!", other.pbThis, other.itemName)
    end
    nil
  end

  def self.switch_refusal(index, slot, lax = false)
    battle = @battle
    return "no battle is running" if battle.nil?
    party = battle.pbParty(index)
    return "party slot #{slot} is empty" if slot < 0 || slot >= party.length || party[slot].nil?
    battler = battle.battlers[index]
    unless lax
      if battler.effects[PBEffects::SkyDrop] >= 0
        return _INTL("¡Caída Libre no deja cambiar a {1}!", battler.pbThis(true))
      end
      return "this battle does not let a Pokémon be switched by choice" unless battle.canSwitch
    end
    shown = []
    scene = Object.new
    scene.define_singleton_method(:pbDisplay) { |message| shown.push(message) }
    allowed = lax ? battle.pbCanSwitchIn?(index, slot, scene) : battle.pbCanSwitch?(index, slot, scene)
    allowed ? nil : (shown.first || "#{party[slot].name} cannot be sent in")
  end

  def self.switch_row(index, slot)
    battle = @battle
    return nil if battle.nil?
    start, _finish = battle.pbTeamIndexRangeFromBattlerIndex(index)
    battle.pbPartyOrder(index)[slot] - start
  end

  def self.move_targets(index, slot)
    battle = @battle
    return nil if battle.nil?
    battler = battle.battlers[index]
    move = battler.moves[slot]
    return nil if move.nil?
    data = move.pbTarget(battler)
    texts = battle.instance_variable_get(:@scene).pbCreateTargetTexts(index, data)
    [data.id.to_s, data.num_targets, texts]
  end

  def self.next_battler
    battle = @battle
    return nil if battle.nil?
    found = battle.battlers.find do |battler|
      battler && battler.fainted? && battle.pbOwnedByPlayer?(battler.index) && battle.pbCanChooseNonActive?(battler.index)
    end
    found&.index
  end

  def self.switchable(index)
    battle = @battle
    return [] if battle.nil?
    (0...battle.pbParty(index).length).select { |slot| battle.pbCanSwitchIn?(index, slot) }
  end

  def self.party_items
    $player.party.map(&:item_id)
  end

  def self.battle_item(item)
    data = GameData::Item.try_get(item)
    return nil if data.nil?
    use = data.battle_use || 0
    place = nil
    $bag.pockets.each_with_index do |pocket, index|
      next if index == 0 || pocket.nil?
      usable = pocket.select { |entry| (GameData::Item.get(entry[0]).battle_use || 0) > 0 }
      row = usable.index { |entry| entry[0] == data.id }
      next if row.nil?
      place = [index, row, usable.length + 1, pocket[pocket.index { |entry| entry[0] == data.id }][1]]
      break
    end
    [data.id.to_s, data.name, use, place]
  end

  def self.bag_refusal
    battle = @battle
    return "no battle is running" if battle.nil?
    return _INTL("Aquí no se pueden usar objetos.") unless battle.internalBattle
    return _INTL("No se pueden usar objetos en este combate.") if battle.respond_to?(:noBag) && battle.noBag
    if battle.trainerBattle?
      return _INTL("¡El modo radical no permite usar objetos en combates de entrenador!") if $game_switches[MODO_RADICAL]
      if defined?(ChallengeModes) && ChallengeModes.on?(:NO_TRAINER_BATTLE_ITEMS)
        return _INTL("¡La regla \"{1}\" bloquea el uso de objetos en las Batallas de Entrenador!", _INTL(ChallengeModes::RULES[:NO_TRAINER_BATTLE_ITEMS][:display_name]))
      end
    end
    nil
  end

  def self.item_refusal(index, item, slot, move = -1, first = true)
    battle = @battle
    refusal = bag_refusal
    return refusal if refusal
    data = GameData::Item.get(item)
    battler = pkmn = nil
    case data.battle_use
    when 1, 2
      return "#{data.name} has no battle use on a Pokémon" unless ItemHandlers.hasBattleUseOnPokemon(data.id)
      battler = battle.pbFindBattler(slot, index)
      pkmn = battle.pbParty(index)[slot]
    when 3
      return "#{data.name} has no battle use on a battler" unless ItemHandlers.hasBattleUseOnBattler(data.id)
      battler = battle.pbFindBattler(slot, index)
      pkmn = battler&.pokemon
    when 4
      battler = battle.battlers[slot]
      pkmn = battler&.pokemon
    when 5
      battler = battle.battlers[index]
      pkmn = battler&.pokemon
    else
      return "#{data.name} cannot be used in battle"
    end
    return "#{data.name} has no Pokémon to be used on" if pkmn.nil?
    shown = []
    scene = Object.new
    scene.define_singleton_method(:pbDisplay) { |message, *_args| shown.push(message) }
    allowed = quietly(battle, shown) do
      next false if [1, 2, 3].include?(data.battle_use) && !battle.pbCanUseItemOnPokemon?(data.id, pkmn, battler, scene)
      ItemHandlers.triggerCanUseInBattle(data.id, pkmn, battler, move, first, battle, scene)
    end
    return shown.first || "#{data.name} cannot be used now" unless allowed
    if data.battle_use == 4 && battle.trainerBattle? && !(data.is_snag_ball? && pkmn.shadowPokemon?)
      return _INTL("¡El Entrenador bloqueó tu Ball! ¡Robar está mal!")
    end
    nil
  end

  QUIET_METHODS = [:pbMessage, :pbSEStop, :pbSEPlay, :pbPlayBuzzerSE]

  def self.quietly(battle, shown)
    [:pbDisplay, :pbDisplayPaused].each do |method|
      battle.define_singleton_method(method) { |message, *_args, &_block| shown.push(message) }
    end
    quieted = QUIET_METHODS.select { |method| Object.private_method_defined?(method) }
    quieted.each do |method|
      Object.send(:alias_method, :"anil_quiet_#{method}", method)
      Object.send(:define_method, method) do |*args, &_block|
        shown.push(args[0]) if method == :pbMessage
        method == :pbMessage ? 0 : nil
      end
    end
    begin
      yield
    ensure
      quieted.each do |method|
        Object.send(:alias_method, method, :"anil_quiet_#{method}")
        Object.send(:remove_method, :"anil_quiet_#{method}")
        Object.send(:private, method)
      end
      [:pbDisplay, :pbDisplayPaused].each { |method| battle.singleton_class.send(:remove_method, method) }
    end
  end

  def self.reveal_refusal(message)
    reveal_text(@battle, message) if @battle && message.is_a?(String)
    nil
  end

  def self.install_game_hooks
    return if @game_hooks || $scene.nil?
    @game_hooks = true
    hook("Battle#pbStartBattle") do
      Battle.class_eval do
        alias_method :anil_bridge_start_battle, :pbStartBattle
        def pbStartBattle(*args)
          AnilBridge.in_battle(self) { anil_bridge_start_battle(*args) }
        end
      end
    end
    install_context_hooks
    install_input_hooks
    install_speed_hooks
    install_snapshot_hooks
    install_event_hooks
    install_stamp_hooks
    install_save_refusal
    install_rules_hooks
  end

  def self.read(request)
    reads = request["paths"]
    unless reads.is_a?(Array) && reads.all? { |entry| entry.is_a?(Array) && (entry.size == 2 || entry.size == 3) }
      raise ArgumentError, "read needs paths as a list of [name, path] or [name, path, depth]"
    end
    default_depth = read_depth(request["depth"] || READ_DEFAULT_DEPTH)
    calls = (request["calls"] || {}).map { |name, methods| [constant(name), methods] }
    stops = (request["stop"] || []).map { |name| constant(name) }
    values = {}
    errors = {}
    reads.each do |name, path, depth|
      begin
        values[name] = dump(resolve(path), depth.nil? ? default_depth : read_depth(depth), calls, stops, [])
      rescue Exception => error
        errors[name] = "#{error.class}: #{error.message}"
      end
    end
    { "values" => values, "errors" => errors }
  end

  def self.read_depth(depth)
    return depth if depth.is_a?(Integer) && depth >= 0 && depth <= READ_MAX_DEPTH
    raise ArgumentError, "depth must be an integer from 0 to #{READ_MAX_DEPTH}"
  end

  def self.constant(name)
    raise ArgumentError, "bad class name #{name.inspect}" unless name.is_a?(String) && name =~ /\A[A-Z]\w*(::[A-Z]\w*)*\z/
    name.split("::").inject(Object) { |scope, part| scope.const_get(part) }
  end

  def self.resolve(path)
    raise ArgumentError, "path must be a string" unless path.is_a?(String)
    root = PATH_ROOT.match(path)
    raise ArgumentError, "bad path root in #{path.inspect}" unless root
    object = root[1][0, 1] == "$" ? eval(root[1], TOPLEVEL_BINDING) : constant(root[1])
    rest = path[root[0].length..-1]
    until rest.empty?
      return nil if object.nil?
      segment = PATH_SEGMENT.match(rest)
      raise ArgumentError, "bad path at #{rest.inspect}" unless segment
      rest = rest[segment[0].length..-1]
      object = if segment[1]
                 object.send(segment[1], *literals(segment[2]))
               elsif segment[3]
                 variable(object, segment[3])
               else
                 object[*literals(segment[4])]
               end
    end
    object
  end

  def self.variable(object, name)
    return object.instance_variable_get(name) unless name[0, 2] == "@@"
    (object.is_a?(Module) ? object : object.class).send(:class_variable_get, name)
  end

  def self.literals(text)
    values = []
    rest = text.to_s.strip
    until rest.empty?
      match = PATH_LITERAL.match(rest)
      raise ArgumentError, "bad argument #{rest.inspect}" unless match
      rest = rest[match[0].length..-1]
      values << literal(match[1])
    end
    values
  end

  def self.literal(token)
    case token
    when "nil" then nil
    when "true" then true
    when "false" then false
    when /\A-?\d+\z/ then token.to_i
    else AnilJSON.decode(token)
    end
  end

  def self.dump(value, depth, calls, stops, path)
    return value if value.nil? || true.equal?(value) || false.equal?(value) || value.is_a?(Numeric)
    return text(value) if value.is_a?(String)
    return value.to_s if value.is_a?(Symbol)
    name = value.class.name
    return { "class" => name, "omitted" => "cycle" } if path.any? { |seen| seen.equal?(value) }
    return { "class" => name, "omitted" => "stop" } if !path.empty? && stops.any? { |klass| value.is_a?(klass) }
    return { "class" => name, "omitted" => "depth" } if depth <= 0
    path.push(value)
    begin
      return value.map { |item| dump(item, depth - 1, calls, stops, path) } if value.is_a?(Array)
      if value.is_a?(Hash)
        entries = value.map { |key, item| [dump(key, depth - 1, calls, stops, path), dump(item, depth - 1, calls, stops, path)] }
        return { "class" => name, "entries" => entries }
      end
      dump_object(value, name, depth, calls, stops, path)
    ensure
      path.pop
    end
  end

  def self.dump_object(value, name, depth, calls, stops, path)
    ivars = {}
    value.instance_variables.sort.each do |ivar|
      ivars[ivar.to_s.sub(/\A@/, "")] = dump(value.instance_variable_get(ivar), depth - 1, calls, stops, path)
    end
    result = { "class" => name, "ivars" => ivars }
    result["inspect"] = clip(value.inspect, READ_INSPECT_CHARS) if ivars.empty?
    methods = calls.select { |klass, names| value.is_a?(klass) }.map { |klass, names| names }.flatten.uniq
    return result if methods.empty?
    called = {}
    methods.each do |method|
      called[method] = begin
        dump(READ_CLONE.bind(value).call(freeze: false).send(method), depth - 1, calls, stops, path)
      rescue Exception => error
        { "error" => "#{error.class}: #{error.message}" }
      end
    end
    result["calls"] = called
    result
  end

  def self.text(value)
    value.unpack("U*")
    value
  rescue ArgumentError
    { "class" => "String", "bytes" => value.unpack("H*")[0] }
  end
end
