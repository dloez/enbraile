module AnilBridge
  RULES_FILE = __FILE__
  RULES = :@anil_rules
  RULES_OBTAIN_CALLS = %i[
    pbAddPokemon pbAddPokemonSilent pbAddToParty pbAddToPartySilent pbAddForeignPokemon
    pbStorePokemon pbNicknameAndStore pbHatch pbStartTrade pbStartTradePC
  ].freeze
  RULES_SHOPS = { "PokemonMart" => "mart", "BattlePointShop" => "bp" }.freeze

  @rules_buying = nil
  @rules_mover = nil
  @rules_yawns = {}

  def self.rules_ledger
    return nil if $PokemonGlobal.nil?
    store = $PokemonGlobal.instance_variable_get(RULES)
    if store.is_a?(Hash)
      store["sleep"] ||= {}
      store["frozen"] ||= []
      return store
    end
    store = { "bought" => {}, "shinies" => [], "sleep" => {}, "frozen" => [] }
    $PokemonGlobal.instance_variable_set(RULES, store)
    store
  end

  def self.rules_freeze(gym)
    store = rules_ledger
    raise ArgumentError, "no game is loaded" if store.nil?
    store["frozen"].push(gym) unless store["frozen"].include?(gym)
    log("rules ledger: gym #{gym}'s paste frozen (#{store['frozen'].size} frozen)")
    store["frozen"].size
  end

  def self.rules_buying(shop)
    outer = @rules_buying
    @rules_buying = shop
    yield
  ensure
    @rules_buying = outer
  end

  def self.rules_bought(item, change)
    return if @rules_buying.nil?
    store = rules_ledger
    return if store.nil?
    id = GameData::Item.get(item).id.to_s
    count = (store["bought"][id] || 0) + change
    if count > 0
      store["bought"][id] = count
    else
      store["bought"].delete(id)
    end
    record("rules_bought", "item" => id, "change" => change, "count" => count, "shop" => @rules_buying)
  rescue Exception => error
    log_exception("rules bought", error)
  end

  def self.rules_moving(battler, move)
    outer = @rules_mover
    @rules_mover = [battler, move]
    yield
  ensure
    @rules_mover = outer
  end

  def self.rules_yawned(user, target)
    @rules_yawns[target.pokemon.personalID] = user.index if user && target&.pokemon
  rescue Exception => error
    log_exception("rules yawn", error)
  end

  def self.rules_battle_start
    @rules_yawns = {}
    store = rules_ledger
    store["sleep"] = {} unless store.nil?
  rescue Exception => error
    log_exception("rules battle start", error)
  end

  def self.rules_slept(battler, user)
    store = rules_ledger
    return if store.nil? || battler.pokemon.nil?
    battle = battler.battle
    personal_id = battler.pokemon.personalID
    yawner = @rules_yawns.delete(personal_id)
    if user.nil? && @rules_mover
      user, move = @rules_mover
    elsif user.nil? && !yawner.nil?
      user = battle.battlers[yawner]
      move = :YAWN
    end
    ours = !user.nil? && user.index != battler.index && battle.pbOwnedByPlayer?(user.index) && battle.opposes?(battler.index)
    if ours
      move_id = (move.respond_to?(:id) ? move.id : move).to_s
      store["sleep"][personal_id] = move_id
      record("rules_sleep", "personal_id" => personal_id, "species" => battler.pokemon.species.to_s, "move" => move_id, "by" => user.index)
      log("rules ledger: #{battler.pokemon.species} (#{personal_id}) put to sleep by #{move_id} from battler #{user.index}")
    elsif store["sleep"].delete(personal_id)
      record("rules_sleep", "personal_id" => personal_id, "species" => battler.pokemon.species.to_s, "move" => nil, "by" => user&.index)
    end
  rescue Exception => error
    log_exception("rules slept", error)
  end

  def self.rules_owned
    owned = $player.party.compact
    return owned if $PokemonStorage.nil?
    $PokemonStorage.boxes.each { |box| owned.concat(box.pokemon.compact) }
    owned
  end

  def self.rules_sweep
    store = rules_ledger
    return if store.nil? || $player.nil?
    rules_owned.each do |pkmn|
      next if pkmn.egg? || !pkmn.shiny? || store["shinies"].include?(pkmn.personalID)
      store["shinies"].push(pkmn.personalID)
      record("rules_shiny", "personal_id" => pkmn.personalID, "species" => pkmn.species.to_s, "count" => store["shinies"].size)
      log("rules ledger: shiny #{pkmn.species} (#{pkmn.personalID}) is shiny #{store['shinies'].size}")
    end
  rescue Exception => error
    log_exception("rules sweep", error)
  end

  def self.install_rules_hooks
    RULES_SHOPS.each do |prefix, shop|
      hook("#{prefix} purchases") do
        Object.const_get("#{prefix}Screen").class_eval do
          alias_method :anil_rules_buy_screen, :pbBuyScreen
          define_method(:pbBuyScreen) do |*args|
            AnilBridge.rules_buying(shop) { anil_rules_buy_screen(*args) }
          end
        end
        Object.const_get(prefix == "PokemonMart" ? "PokemonMartAdapter" : "BattlePointShopAdapter").class_eval do
          alias_method :anil_rules_add_item, :addItem
          def addItem(item)
            added = anil_rules_add_item(item)
            AnilBridge.rules_bought(item, 1) if added
            added
          end
          alias_method :anil_rules_remove_item, :removeItem
          def removeItem(item)
            removed = anil_rules_remove_item(item)
            AnilBridge.rules_bought(item, -1) if removed
            removed
          end
        end
      end
    end
    hook("Pokémon obtained shiny sweep") do
      RULES_OBTAIN_CALLS.each do |name|
        next unless Object.private_method_defined?(name) || Object.method_defined?(name)
        original = :"anil_rules_#{name}"
        Object.class_eval do
          alias_method original, name
          define_method(name) do |*args, **kwargs, &block|
            result = send(original, *args, **kwargs, &block)
            AnilBridge.rules_sweep
            result
          end
          private name, original
        end
      end
    end
    hook("Battle#pbStartBattle shiny sweep") do
      Battle.class_eval do
        alias_method :anil_rules_start_battle, :pbStartBattle
        def pbStartBattle(*args)
          AnilBridge.rules_battle_start
          anil_rules_start_battle(*args)
        ensure
          AnilBridge.rules_sweep
        end
      end
    end
    hook("sleep inflicted in battle") do
      Battle::Battler.class_eval do
        alias_method :anil_rules_use_move, :pbUseMove
        def pbUseMove(choice, *args)
          AnilBridge.rules_moving(self, choice[2]) { anil_rules_use_move(choice, *args) }
        end
        alias_method :anil_rules_inflict_status, :pbInflictStatus
        def pbInflictStatus(new_status, *args)
          result = anil_rules_inflict_status(new_status, *args)
          AnilBridge.rules_slept(self, args[2]) if new_status == :SLEEP
          result
        end
      end
      Battle::Move::SleepTargetNextTurn.class_eval do
        alias_method :anil_rules_yawn, :pbEffectAgainstTarget
        def pbEffectAgainstTarget(user, target)
          result = anil_rules_yawn(user, target)
          AnilBridge.rules_yawned(user, target)
          result
        end
      end
    end
  end
end
