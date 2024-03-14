// Exposes a 'realms-friendly' version of the generic useVoterWeightPlugins hook,
// which knows how to get the current realm, governance mint, and wallet public keys
// this simplifies usage across the realms codebase
import { useVoterWeightPlugins } from '../VoterWeightPlugins'
import { useRealmQuery } from '@hooks/queries/realm'
import useWalletOnePointOh from '@hooks/useWalletOnePointOh'
import { GovernanceRole } from '../@types/types'
import { useSelectedDelegatorStore } from '../stores/useSelectedDelegatorStore'
import { UseVoterWeightPluginsReturnType } from '../VoterWeightPlugins/useVoterWeightPlugins'
import { PublicKey } from '@solana/web3.js'
import { CalculatedWeight } from '../VoterWeightPlugins/lib/types'
import useDelegators from '@components/VotePanel/useDelegators'

type UseRealmVoterWeightPluginsReturnType = UseVoterWeightPluginsReturnType & {
  totalCalculatedVoterWeight: CalculatedWeight | undefined
}

export const useRealmVoterWeightPlugins = (
  role: GovernanceRole = 'community'
): UseRealmVoterWeightPluginsReturnType => {
  const realm = useRealmQuery().data?.result
  const wallet = useWalletOnePointOh()
  const governanceMintPublicKey =
    role === 'community'
      ? realm?.account.communityMint
      : realm?.account.config.councilMint
  const selectedDelegator = useSelectedDelegatorStore((s) =>
    role === 'community' ? s.communityDelegator : s.councilDelegator
  )
  const delegators = useDelegators(role)

  // if a delegator is selected, use it, otherwise use the currently connected wallet
  const nonAggregatedResult = useVoterWeightPlugins({
    realmPublicKey: realm?.pubkey,
    governanceMintPublicKey,
    // TODO CK Pass all the delegated wallets here

    // This will be the list of delegators that comes from the useDelegators hook (this is a set of TORs, so you should get the wallet public keys from them)
    // but we might need special logic in case a single selected delegator is set
    // i.e. if selectedDelegator is set, just pass that, otherwise pass everything.
    walletPublicKeys: [
      selectedDelegator
        ? selectedDelegator
        : delegators?.map((d) => d.account.governingTokenOwner) ??
          wallet?.publicKey ??
          undefined,
    ].filter(Boolean) as PublicKey[],
  })

  const totalCalculatedVoterWeight = nonAggregatedResult.calculatedVoterWeights?.reduce(
    (acc, weight) => {
      if (!acc || !delegators) return weight

      // TODO CK combine them
      return {
        ...weight,
        value: delegators.reduce(
          (acc, d) => acc?.add(d.account.governingTokenDepositAmount),
          weight.value
        ),
      }
    }
  )

  return {
    ...nonAggregatedResult,
    totalCalculatedVoterWeight,
  }
}

// Get the current weights for the community and council governances - should be used in cases where the realm is known but the choice of governance is not,
// e.g. when creating a proposal
export const useRealmVoterWeights = () => {
  const {
    calculatedMaxVoterWeight: communityMaxWeight,
    totalCalculatedVoterWeight: communityWeight,
  } = useRealmVoterWeightPlugins('community')
  const {
    calculatedMaxVoterWeight: councilMaxWeight,
    totalCalculatedVoterWeight: councilWeight,
  } = useRealmVoterWeightPlugins('council')

  return {
    communityMaxWeight,
    communityWeight,
    councilMaxWeight,
    councilWeight,
  }
}
